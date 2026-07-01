import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, fmtDate, styles } from './_layout'

interface Props {
  guestName?: string
  reference?: string
  checkIn?: string
  checkOut?: string
  rooms?: string
  lockerCode?: string | null
}

const Email = (p: Props) => (
  <EmailLayout preview={`You're fully paid — key-locker code inside (${p.reference ?? ''})`}>
    <Heading as="h2" style={styles.h2}>You're all set ✓</Heading>
    <Text style={styles.p}>
      Hi {p.guestName ?? 'guest'}, your balance is received in full. See you on {p.checkIn ? fmtDate(p.checkIn) : 'check-in day'}.
    </Text>
    <div style={styles.panel}>
      <p style={styles.row}><span style={styles.label}>Booking</span><span style={styles.value}>{p.reference ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Check-in</span><span style={styles.value}>{p.checkIn ? fmtDate(p.checkIn) : '—'} · from 3:00 PM</span></p>
      <p style={styles.row}><span style={styles.label}>Check-out</span><span style={styles.value}>{p.checkOut ? fmtDate(p.checkOut) : '—'} · by 12:00 PM</span></p>
      {p.rooms && <p style={styles.row}><span style={styles.label}>Rooms</span><span style={styles.value}>{p.rooms}</span></p>}
      <p style={{ ...styles.row, marginTop: '8px' }}>
        <span style={styles.label}>Key locker</span>
        <span style={{ ...styles.value, fontFamily: 'ui-monospace, monospace', backgroundColor: '#fff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #d9d3bf' }}>
          {p.lockerCode ? `Code ${p.lockerCode}` : 'Shared on check-in day via WhatsApp'}
        </span>
      </p>
    </div>
    <Text style={styles.p}>
      Please return keys to the locker on check-out and keep the code confidential. The refundable RM50/room security deposit is refunded after check-out, subject to a room inspection ensuring no damage or loss has occurred.
    </Text>
    <Text style={styles.p}>Drive safe — see you at Chendering!</Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `You're fully paid ✓ — ${d.reference ?? ''} · Rajawali D'Cabin`.trim(),
  displayName: 'Fully paid · locker code',
  previewData: { guestName: 'Ahmad', reference: 'RJW-1234', checkIn: '2026-07-10', checkOut: '2026-07-12', rooms: 'Family Suite', lockerCode: '4821' } as Props,
} satisfies TemplateEntry