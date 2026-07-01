import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, fmtDate, money, styles } from './_layout'

interface Props {
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  reference?: string
  bookingId?: string
  roomType?: string
  checkIn?: string
  checkOut?: string
  nights?: number
  guests?: number
  total?: number
  securityDeposit?: number
  remaining?: number
  paymentType?: 'deposit' | 'full'
  rooms?: { name: string; total: number }[]
}

const ADMIN_BASE = "https://drajawalicabin.com/admin/invoice"

const Email = (p: Props) => {
  const isFull = p.paymentType === 'full' || (p.remaining ?? 0) <= 0
  const ref = p.reference ?? '—'
  const url = p.bookingId ? `${ADMIN_BASE}/${p.bookingId}` : 'https://drajawalicabin.com/admin'
  return (
    <EmailLayout preview={`New reservation ${ref} — ${isFull ? 'paid in full' : 'deposit received'}`}>
      <Heading as="h2" style={styles.h2}>New reservation received</Heading>
      <Text style={styles.p}>
        {p.guestName ?? 'A guest'} just submitted a booking with {isFull ? 'full payment' : 'deposit'} proof. Please review and confirm.
      </Text>
      <div style={styles.panel}>
        <p style={styles.row}><span style={styles.label}>Reference</span><span style={styles.value}>{ref}</span></p>
        <p style={styles.row}><span style={styles.label}>Guest</span><span style={styles.value}>{p.guestName ?? '—'}</span></p>
        {p.guestEmail && <p style={styles.row}><span style={styles.label}>Email</span><span style={styles.value}>{p.guestEmail}</span></p>}
        {p.guestPhone && <p style={styles.row}><span style={styles.label}>Phone</span><span style={styles.value}>{p.guestPhone}</span></p>}
        <p style={styles.row}><span style={styles.label}>Cabin</span><span style={styles.value}>{p.rooms && p.rooms.length > 1 ? `${p.rooms.length} rooms` : p.roomType ?? '—'}</span></p>
        <p style={styles.row}><span style={styles.label}>Check-in</span><span style={styles.value}>{p.checkIn ? fmtDate(p.checkIn) : '—'}</span></p>
        <p style={styles.row}><span style={styles.label}>Check-out</span><span style={styles.value}>{p.checkOut ? fmtDate(p.checkOut) : '—'}</span></p>
        <p style={styles.row}><span style={styles.label}>Nights / guests</span><span style={styles.value}>{p.nights ?? '—'} night(s) · {p.guests ?? '—'} guest(s)</span></p>
        <p style={{ ...styles.row, marginTop: '8px' }}><span style={styles.label}>Total</span><span style={styles.value}>{money(p.total)}</span></p>
        {isFull ? (
          <p style={styles.row}><span style={styles.label}>Paid</span><span style={styles.value}>{money(p.total)} (in full)</span></p>
        ) : (
          <>
            <p style={styles.row}><span style={styles.label}>Deposit</span><span style={styles.value}>{money(p.deposit)}</span></p>
            <p style={styles.row}><span style={styles.label}>Balance</span><span style={styles.value}>{money(p.remaining)}</span></p>
          </>
        )}
      </div>
      <Button href={url} style={styles.cta}>Open booking</Button>
      <Text style={{ ...styles.p, marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
        Verify the payment proof in the admin console, then confirm or reject the booking.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `New booking ${d.reference ?? ''} — ${d.guestName ?? 'guest'}`.trim(),
  displayName: 'Admin: new booking alert',
  previewData: { guestName: 'Ahmad', guestEmail: 'ahmad@example.com', guestPhone: '+60123456789', reference: 'RJW-1234', bookingId: 'abc-123', roomType: '2 PAX Family Suite', checkIn: '2026-07-10', checkOut: '2026-07-12', nights: 2, guests: 2, total: 480, deposit: 50, remaining: 430, paymentType: 'deposit' } as Props,
} satisfies TemplateEntry
