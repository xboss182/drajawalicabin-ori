import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { requestManageLink } from "@/lib/booking.functions";
import { LanguageToggle, useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/find-booking")({
  head: () => ({
    meta: [
      { title: "Find your booking — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Lost your Rajawali D'Cabin booking link? Enter your email and reference number and we'll re-send the manage link to your inbox." },
      { property: "og:title", content: "Find your booking — Rajawali D'Cabin" },
      { property: "og:description", content: "Recover your Rajawali D'Cabin booking management link by email." },
      { property: "og:url", content: "https://drajawalicabin.com/find-booking" },
    ],
    links: [{ rel: "canonical", href: "https://drajawalicabin.com/find-booking" }],
  }),
  component: FindBookingPage,
});

function FindBookingPage() {
  const { lang } = useLanguage();
  const isBM = lang === "bm";
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const copy = isBM
    ? {
        eyebrow: "Cari tempahan",
        title: "Lupa link tempahan?",
        intro:
          "Masukkan e-mel dan nombor tempahan (cth. RJW-1234). Jika padan, kami akan e-mel semula link untuk uruskan tempahan anda.",
        emailLabel: "E-mel",
        refLabel: "Nombor tempahan",
        submit: "Hantar semula link",
        sending: "Menghantar…",
        successTitle: "Semak e-mel anda.",
        successBody:
          "Jika ada tempahan yang padan, kami baru hantarkan link untuk uruskan tempahan ke e-mel anda.",
        backHome: "Kembali ke utama",
        rateLimit: "Terlalu banyak cubaan. Sila cuba lagi dalam 15 minit.",
        genericErr: "Tidak dapat menghantar. Sila cuba sebentar lagi.",
      }
    : {
        eyebrow: "Find your booking",
        title: "Lost your booking link?",
        intro:
          "Enter the email you booked with and your booking reference (e.g. RJW-1234). If they match, we'll re-send the manage link to that email.",
        emailLabel: "Email",
        refLabel: "Booking reference",
        submit: "Re-send manage link",
        sending: "Sending…",
        successTitle: "Check your inbox.",
        successBody:
          "If a matching booking was found, we just emailed the manage link to that address.",
        backHome: "Back to home",
        rateLimit: "Too many attempts. Please try again in 15 minutes.",
        genericErr: "Could not send. Please try again shortly.",
      };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await requestManageLink({ data: { email: email.trim(), reference: reference.trim() } });
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (/Too many/i.test(msg)) setErr(copy.rateLimit);
      else setErr(copy.genericErr);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
          <div className="flex items-center gap-4">
            <LanguageToggle variant="dark" />
            <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">
              {isBM ? "Utama" : "Home"}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-6 py-20 lg:px-10">
        <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">{copy.eyebrow}</p>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{copy.title}</h1>
        <p className="mt-4 text-foreground/75">{copy.intro}</p>

        {done ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl text-forest">{copy.successTitle}</h2>
            <p className="mt-2 text-sm text-foreground/75">{copy.successBody}</p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full border border-border px-6 py-3 text-sm"
            >
              {copy.backHome}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.25em] text-stone">{copy.emailLabel}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-forest focus:outline-none"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.25em] text-stone">{copy.refLabel}</span>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 font-mono text-sm focus:border-forest focus:outline-none"
                placeholder="RJW-1234"
                maxLength={40}
              />
            </label>

            {err && (
              <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90 disabled:opacity-60"
            >
              {submitting ? copy.sending : copy.submit}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}