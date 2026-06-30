import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimAdminIfFirst, isAdminRecipient } from "@/lib/booking.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (raw: Record<string, unknown>) => ({
    denied: raw.denied === 1 || raw.denied === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Owner sign in — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Owner and staff sign-in for the Rajawali D'Cabin Chalet management console." },
      { property: "og:title", content: "Owner sign in — Rajawali D'Cabin" },
      { property: "og:description", content: "Restricted sign-in for Rajawali D'Cabin staff and owners." },
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

  // If already signed in, run the gate once.
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