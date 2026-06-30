import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_layout'

interface Props {
  guestName?: string
  reference?: string
  roomType?: string
  manageUrl?: string
}

const Email = (p: Props) => (
  <EmailLayout preview={`Your booking link — ${p.reference ?? ''}`}>
    <Heading as="h2" style={styles.h2}>Manage your booking</Heading>
    <Text style={styles.p}>
      Hi {p.guestName ?? 'guest'}, here is the secure link to manage your booking.
    </Text>
    <div style={styles.panel}>
      <p style={styles.row}><span style={styles.label}>Booking</span><span style={styles.value}>{p.reference ?? '—'}</span></p>
      <p style={styles.row}><span style={styles.label}>Cabin</span><span style={styles.value}>{p.roomType ?? '—'}</span></p>
    </div>
    {p.manageUrl && (
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={p.manageUrl} style={styles.cta}>Open my booking</Button>
      </Section>
    )}
    <Text style={styles.p}>If you didn't request this, you can safely ignore this email.</Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your booking link — ${d.reference ?? ''} · Rajawali D'Cabin`.trim(),
  displayName: 'Manage link',
  previewData: { guestName: 'Ahmad', reference: 'RJW-1234', roomType: '2 PAX Family Suite', manageUrl: 'https://drajawalicabin.com/manage-booking?id=x&token=y' } as Props,
} satisfies TemplateEntry