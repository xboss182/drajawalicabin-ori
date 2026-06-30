import type { ComponentType } from 'react'
import { template as bookingSummary } from './booking-summary'
import { template as balanceReminder } from './balance-reminder'
import { template as fullyPaid } from './fully-paid'
import { template as manageLink } from './manage-link'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-summary': bookingSummary,
  'balance-reminder': balanceReminder,
  'fully-paid': fullyPaid,
  'manage-link': manageLink,
}
