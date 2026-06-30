// Server-only helper to send a registered transactional email. Mirrors the
// public route /lovable/email/transactional/send but skips JWT auth — it is
// intended to be called from already-trusted server functions that hold the
// service-role client.
import * as React from 'react'
import { render } from 'react-email'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = "Rajawali D'Cabin"
const SENDER_DOMAIN = 'notify.drajawalicabin.com'
const FROM_DOMAIN = 'drajawalicabin.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface SendArgs {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, any>
}

/** Render + enqueue a transactional email. Fails silently with a log on error. */
export async function sendTransactionalEmail(admin: SupabaseClient, args: SendArgs): Promise<void> {
  const messageId = crypto.randomUUID()
  const template = TEMPLATES[args.templateName]
  if (!template) {
    console.error('[email] template not found', args.templateName)
    return
  }
  const recipient = (template.to || args.recipientEmail)?.toLowerCase()
  if (!recipient) return

  // Suppression check
  const { data: suppressed } = await admin
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipient)
    .maybeSingle()
  if (suppressed) {
    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: recipient,
      status: 'suppressed',
    } as never)
    return
  }

  // Unsubscribe token (one per email)
  let unsubscribeToken: string | null = null
  const { data: existing } = await admin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', recipient)
    .maybeSingle()
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token
  } else if (!existing) {
    const fresh = generateToken()
    await admin.from('email_unsubscribe_tokens').upsert(
      { token: fresh, email: recipient } as never,
      { onConflict: 'email', ignoreDuplicates: true },
    )
    const { data: stored } = await admin
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', recipient)
      .maybeSingle()
    unsubscribeToken = stored?.token ?? fresh
  }

  // Render
  const element = React.createElement(template.component, args.templateData ?? {})
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function'
    ? template.subject(args.templateData ?? {})
    : template.subject

  await admin.from('email_send_log').insert({
    message_id: messageId,
    template_name: args.templateName,
    recipient_email: recipient,
    status: 'pending',
  } as never)

  const { error } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: args.templateName,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as never)
  if (error) {
    console.error('[email] enqueue failed', error.message)
    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: error.message,
    } as never)
  }
}

/**
 * Fetch active admin emails from admin_email_recipients that opted-in to
 * `notifyColumn` (one of: notify_new_booking, notify_payment_proof, notify_fully_paid).
 */
export async function getAdminRecipients(
  admin: SupabaseClient,
  notifyColumn: 'notify_new_booking' | 'notify_payment_proof' | 'notify_fully_paid',
): Promise<string[]> {
  const { data, error } = await admin
    .from('admin_email_recipients')
    .select(`email, is_active, ${notifyColumn}`)
    .eq('is_active', true)
    .eq(notifyColumn, true)
  if (error || !data) return []
  return data.map((r: any) => String(r.email).toLowerCase()).filter(Boolean)
}