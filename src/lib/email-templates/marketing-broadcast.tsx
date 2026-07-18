import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_layout'

interface Props {
  guestName?: string
  subject?: string
  bodyHtml?: string
}

const Email = (p: Props) => {
  const greeting = p.guestName ? `Hi ${p.guestName},` : 'Hi there,'
  return (
    <EmailLayout preview={p.subject ?? 'A note from Rajawali D\'Cabin'}>
      <Heading as="h2" style={styles.h2}>{p.subject ?? 'A note from us'}</Heading>
      <Text style={styles.p}>{greeting}</Text>
      <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#1f2937' }}
        dangerouslySetInnerHTML={{ __html: p.bodyHtml ?? '' }} />
      <Text style={{ ...styles.p, marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
        You're receiving this because you've stayed with us at Rajawali D'Cabin. Reply to this email or WhatsApp 011-5500 7204 to reach us.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => String(d.subject ?? "News from Rajawali D'Cabin"),
  displayName: 'Marketing broadcast',
  previewData: { guestName: 'Ahmad', subject: 'Stay 2 nights, save 10%', bodyHtml: '<p>We\'re running a special this month...</p>' } as Props,
} satisfies TemplateEntry