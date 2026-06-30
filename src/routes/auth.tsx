import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { claimAdminIfFirst, isAdminRecipient } from "@/lib/booking.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (raw: Record<string, unknown>) => ({
    denied: raw.denied === 1 || raw.denied === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Owner sign in — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gateRan = useRef(false);

  async function gateAndGo() {
    try {
      await claimAdminIfFirst();
    } catch {
      /* not signed in or already claimed */
    }
    try {
      const { allowed } = await isAdminRecipient();
      if (!allowed) {
        await supabase.auth.signOut();
        setErr("Access denied — your email is not on the admin recipient list. Ask an owner to add it in Settings.");
        return;
      }
    } catch {
      setErr("Could not verify admin access. Try again.");
      return;
    }
    navigate({ to: "/admin" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await gateAndGo();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      // tokens received — session set; run gate
      await gateAndGo();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  // After Google redirect-back (or arriving already signed in), run the gate once.
  useEffect(() => {
    if (gateRan.current) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !gateRan.current) {
        gateRan.current = true;
        void gateAndGo();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
      </header>
      <section className="mx-auto max-w-md px-6 py-20">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Owner area</p>
        <h1 className="mt-3 font-display text-4xl text-forest">Sign in</h1>
        <p className="mt-3 text-sm text-foreground/70">
          Sign in to review bookings and confirm payments. Access is restricted to emails listed in
          admin notification recipients (Settings).
        </p>
        {denied && !err && (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Access denied — your email is not on the admin recipient list.
          </p>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-7 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.3 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.1 17.6 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 2.9-2.2 5.3-4.7 7l7.4 5.7c4.3-4 6.8-9.9 6.8-17.2z"/>
            <path fill="#FBBC05" d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.6 2.6 10.8l7.8-6.1z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.4-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.4 0-11.7-3.6-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-stone">
          <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-stone">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-stone">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          {err && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60"
          >
            {busy ? "Working…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}