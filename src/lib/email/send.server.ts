// Server-only helper to send a registered transactional email through
// Lovable's managed email API. Delivery, retries, rate limits, suppression and
// unsubscribe handling are enforced by Lovable server-side; this helper only
// records the app's own audit rows in `email_send_log`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

export interface SendArgs {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, any>
}

async function logSend(
  admin: SupabaseClient,
  row: {
    template_name: string
    recipient_email: string
    status: 'sent' | 'suppressed' | 'failed'
    error_message?: string
  },
): Promise<void> {
  const { error } = await admin.from('email_send_log').insert(row as never)
  if (error) {
    console.error('[email] failed to write email_send_log', {
      code: error.code,
      message: error.message,
    })
  }
}

/** Send a registered transactional email. Fails silently with a log on error. */
export async function sendTransactionalEmail(admin: SupabaseClient, args: SendArgs): Promise<void> {
  const recipient = args.recipientEmail?.toLowerCase()

  try {
    const result = await sendTemplateEmail(args.templateName, recipient, {
      templateData: args.templateData,
      idempotencyKey: args.idempotencyKey,
    })

    if (result.sent) {
      await logSend(admin, {
        template_name: args.templateName,
        recipient_email: recipient,
        status: 'sent',
      })
    } else {
      await logSend(admin, {
        template_name: args.templateName,
        recipient_email: recipient,
        status: 'suppressed',
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[email] send failed', args.templateName, message)
    await logSend(admin, {
      template_name: args.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
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
