import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, Arial, sans-serif',
  color: '#1f2937',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const brandBar: React.CSSProperties = {
  borderBottom: '3px solid #1f3a2b',
  paddingBottom: '12px',
  marginBottom: '24px',
}
const brand: React.CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: '22px',
  fontWeight: 600,
  color: '#1f3a2b',
  margin: 0,
}
const tagline: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '2px 0 0',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginTop: '32px',
  lineHeight: 1.5,
}

export const styles = {
  h2: { fontSize: '18px', color: '#1f3a2b', margin: '0 0 8px' } as React.CSSProperties,
  p: { fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px' } as React.CSSProperties,
  panel: {
    backgroundColor: '#f6f5f0',
    border: '1px solid #e7e3d4',
    borderRadius: '8px',
    padding: '16px 18px',
    margin: '16px 0',
  } as React.CSSProperties,
  row: { fontSize: '13px', lineHeight: 1.7, margin: 0 } as React.CSSProperties,
  label: { color: '#6b7280', display: 'inline-block', width: '140px' } as React.CSSProperties,
  value: { color: '#1f2937', fontWeight: 500 } as React.CSSProperties,
  cta: {
    display: 'inline-block',
    backgroundColor: '#1f3a2b',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '12px 20px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  } as React.CSSProperties,
}

export function EmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Heading as="h1" style={brand}>Rajawali D'Cabin Chalet</Heading>
            <Text style={tagline}>Chendering, Terengganu</Text>
          </Section>
          {children}
          <Hr style={{ borderColor: '#e5e7eb', margin: '32px 0 16px' }} />
          <Text style={footer}>
            Questions? WhatsApp 011-5500 7204.<br />
            Rajawali D'Cabin Chalet · Chendering, Terengganu, Malaysia
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function money(n: number | null | undefined) {
  return `RM ${Number(n ?? 0).toFixed(2)}`
}
export function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return d }
}