import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, fmtDate, money, styles } from './_layout'

interface Props {
  guestName?: string
  reference?: string
  roomType?: string
  checkIn?: string
  total?: number
  securityDeposit?: number
  remaining?: number
  manageUrl?: string
}

const Email = (p: Props) => (
  <EmailLayout preview={`Room rate balance due in 7 days — ${p.reference ?? ''}`}>
    <Heading as="h2" style={styles.h2}>Room rate balance due in 7 days</Heading>
    <Text style={styles.p}>
      Hi {p.guestName ?? 'guest'}, your stay on {p.checkIn ? fmtDate(p.checkIn) : 'your check-in date'} is coming up.
      Please settle the remaining room rate balance to complete your booking. Your security deposit is separate and refundable after check-out.
    </Text>
    <div style={styles.panel}>
      <p style={styles.row}><span style={styles.label}>Booking</span><span style={styles.value}>{p.reference ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Cabin</span><span style={styles.value}>{p.roomType ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Check-in</span><span style={styles.value}>{p.checkIn ? fmtDate(p.checkIn) : '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Room rate</span><span style={styles.value}>{money(p.total)}</span></p>
      <p style={styles.row}><span style={styles.label}>Security deposit paid</span><span style={styles.value}>{money(p.securityDeposit)} ✓ (refundable after check-out)</span></p>
      <p style={styles.row}><span style={styles.label}>Room rate balance due</span><span style={styles.value}>{money(p.remaining)}</span></p>
    </div>
    {p.manageUrl && (
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={p.manageUrl} style={styles.cta}>Pay room rate balance</Button>
      </Section>
    )}
    <Text style={styles.p}>Once we receive your room rate balance we will share your key-locker code.</Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Room rate balance due in 7 days — ${d.reference ?? ''} · Rajawali D'Cabin`.trim(),
  displayName: 'Balance reminder',
  previewData: { guestName: 'Ahmad', reference: 'RJW-1234', roomType: '2 PAX Family Suite', checkIn: '2026-07-10', total: 480, securityDeposit: 50, remaining: 480, manageUrl: 'https://drajawalicabin.com/manage-booking?id=x&token=y' } as Props,
} satisfies TemplateEntry