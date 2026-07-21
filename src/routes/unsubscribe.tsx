import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Unsubscribe — Rajawali D\'Cabin' },
      { name: 'robots', content: 'noindex' },
      { name: 'description', content: 'Update your email preferences and unsubscribe from Rajawali D\'Cabin booking and marketing emails.' },
      { property: 'og:title', content: 'Unsubscribe — Rajawali D\'Cabin' },
      { property: 'og:description', content: 'Manage your email preferences for Rajawali D\'Cabin Chalet.' },
      { property: 'og:url', content: 'https://drajawalicabin.com/unsubscribe' },
    ],
    links: [{ rel: 'canonical', href: 'https://drajawalicabin.com/unsubscribe' }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === 'string' ? s.token : '' }),
  component: UnsubscribePage,
})

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; email: string }
  | { kind: 'already' }
  | { kind: 'invalid' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const { token } = useSearch({ from: '/unsubscribe' })
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) { setState({ kind: 'invalid' }); return }
        if (data.used) { setState({ kind: 'already' }); return }
        setState({ kind: 'ready', email: data.email ?? '' })
      })
      .catch(() => setState({ kind: 'invalid' }))
  }, [token])

  async function confirm() {
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setState({ kind: 'error', message: d.error ?? 'Failed to unsubscribe' })
        return
      }
      setState({ kind: 'done' })
    } catch {
      setState({ kind: 'error', message: 'Network error' })
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <div className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-2xl text-forest">Unsubscribe</h1>
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-sm">
          {state.kind === 'loading' && <p>Verifying link…</p>}
          {state.kind === 'invalid' && <p>This link is invalid or has expired.</p>}
          {state.kind === 'already' && <p>This address is already unsubscribed. No further emails will be sent.</p>}
          {state.kind === 'ready' && (
            <>
              <p>Unsubscribe <strong>{state.email}</strong> from all transactional emails from Rajawali D'Cabin?</p>
              <button onClick={confirm} className="mt-4 rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut">
                Confirm unsubscribe
              </button>
            </>
          )}
          {state.kind === 'submitting' && <p>Unsubscribing…</p>}
          {state.kind === 'done' && <p>Done. You won't receive further emails from us.</p>}
          {state.kind === 'error' && <p className="text-red-700">{state.message}</p>}
        </div>
      </div>
    </main>
  )
}