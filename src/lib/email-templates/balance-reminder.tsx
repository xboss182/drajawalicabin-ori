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
  <EmailLayout preview={`Balance due in 7 days — ${p.reference ?? ''}`}>
    <Heading as="h2" style={styles.h2}>Balance due in 7 days</Heading>
    <Text style={styles.p}>
      Hi {p.guestName ?? 'guest'}, your stay on {p.checkIn ? fmtDate(p.checkIn) : 'your check-in date'} is coming up.
      Please settle the remaining balance to complete your booking.
    </Text>
    <div style={styles.panel}>
      <p style={styles.row}><span style={styles.label}>Booking</span><span style={styles.value}>{p.reference ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Cabin</span><span style={styles.value}>{p.roomType ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Check-in</span><span style={styles.value}>{p.checkIn ? fmtDate(p.checkIn) : '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Total</span><span style={styles.value}>{money(p.total)}</span></p>
      <p style={styles.row}><span style={styles.label}>Deposit paid</span><span style={styles.value}>{money(p.deposit)} ✓</span></p>
      <p style={styles.row}><span style={styles.label}>Balance due</span><span style={styles.value}>{money(p.remaining)}</span></p>
    </div>
    {p.manageUrl && (
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={p.manageUrl} style={styles.cta}>Pay balance</Button>
      </Section>
    )}
    <Text style={styles.p}>Once we receive your balance we will share your key-locker code.</Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Balance due in 7 days — ${d.reference ?? ''} · Rajawali D'Cabin`.trim(),
  displayName: 'Balance reminder',
  previewData: { guestName: 'Ahmad', reference: 'RJW-1234', roomType: '2 PAX Family Suite', checkIn: '2026-07-10', total: 480, deposit: 50, remaining: 430, manageUrl: 'https://drajawalicabin.com/manage-booking?id=x&token=y' } as Props,
} satisfies TemplateEntry