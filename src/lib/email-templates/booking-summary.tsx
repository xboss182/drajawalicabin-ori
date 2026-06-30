import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, fmtDate, money, styles } from './_layout'

interface Props {
  guestName?: string
  reference?: string
  roomType?: string
  checkIn?: string
  checkOut?: string
  nights?: number
  guests?: number
  total?: number
  deposit?: number
  remaining?: number
  paymentType?: 'deposit' | 'full'
  rooms?: { name: string; total: number }[]
}

const Email = (p: Props) => {
  const isFull = p.paymentType === 'full' || (p.remaining ?? 0) <= 0
  const ref = p.reference ?? '—'
  return (
    <EmailLayout preview={`Booking ${ref} received — ${isFull ? 'paid in full' : 'deposit confirmed'}`}>
      <Heading as="h2" style={styles.h2}>Thank you, {p.guestName ?? 'guest'}</Heading>
      <Text style={styles.p}>
        {isFull
          ? `We have received your full payment proof of ${money(p.total)}. Our team will verify the transfer shortly.`
          : `We have received your booking and your RM${(p.deposit ?? 50).toFixed(2)} deposit proof. Your dates are now reserved.`}
      </Text>
      <div style={styles.panel}>
        <p style={styles.row}><span style={styles.label}>Booking</span><span style={styles.value}>{ref}</span></p>
        <p style={styles.row}><span style={styles.label}>Cabin</span><span style={styles.value}>{p.rooms && p.rooms.length > 1 ? `${p.rooms.length} rooms` : p.roomType ?? '—'}</span></p>
        <p style={styles.row}><span style={styles.label}>Check-in</span><span style={styles.value}>{p.checkIn ? fmtDate(p.checkIn) : '—'} · 3:00 PM</span></p>
        <p style={styles.row}><span style={styles.label}>Check-out</span><span style={styles.value}>{p.checkOut ? fmtDate(p.checkOut) : '—'} · 12:00 PM</span></p>
        <p style={styles.row}><span style={styles.label}>Nights / guests</span><span style={styles.value}>{p.nights ?? '—'} night(s) · {p.guests ?? '—'} guest(s)</span></p>
        {p.rooms && p.rooms.length > 1 && p.rooms.map((r, i) => (
          <p key={i} style={styles.row}><span style={styles.label}>{i === 0 ? 'Rooms' : ''}</span><span style={styles.value}>{r.name} — {money(r.total)}</span></p>
        ))}
        <p style={{ ...styles.row, marginTop: '8px' }}><span style={styles.label}>Total</span><span style={styles.value}>{money(p.total)}</span></p>
        {isFull ? (
          <p style={styles.row}><span style={styles.label}>Paid</span><span style={styles.value}>{money(p.total)} ✓ (in full)</span></p>
        ) : (
          <>
            <p style={styles.row}><span style={styles.label}>Deposit paid</span><span style={styles.value}>{money(p.deposit)} ✓</span></p>
            <p style={styles.row}><span style={styles.label}>Balance</span><span style={styles.value}>{money(p.remaining)} · due 7 days before check-in</span></p>
          </>
        )}
      </div>
      <Text style={styles.p}>
        {isFull
          ? 'Once we verify the transfer we will share your key-locker check-in code.'
          : 'We will send a balance-payment reminder 7 days before check-in with a secure link to settle the remainder.'}
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Booking ${d.reference ?? ''} received — Rajawali D'Cabin`.trim(),
  displayName: 'Booking received',
  previewData: { guestName: 'Ahmad', reference: 'RJW-1234', roomType: '2 PAX Family Suite', checkIn: '2026-07-10', checkOut: '2026-07-12', nights: 2, guests: 2, total: 480, deposit: 50, remaining: 430, paymentType: 'deposit' } as Props,
} satisfies TemplateEntry