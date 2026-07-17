import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getHeroPromoCta,
  updateHeroPromoCta,
  generatePromoCtaAi,
} from "@/lib/promo-cta.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/promo")({
  head: () => ({
    meta: [
      { title: "Promo CTA — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PromoPage,
});

function PromoPage() {
  const [enabled, setEnabled] = useState(true);
  const [textEn, setTextEn] = useState("");
  const [textBm, setTextBm] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "ai">(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getHeroPromoCta();
        setEnabled(s.enabled);
        setTextEn(s.text_en);
        setTextBm(s.text_bm);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setErr(null);
    setBusy("save");
    try {
      await updateHeroPromoCta({
        data: {
          enabled,
          text_en: textEn.trim(),
          text_bm: textBm.trim(),
        },
      });
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 1800);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setErr(null);
    setBusy("ai");
    try {
      const r = await generatePromoCtaAi({ data: { hint: hint.trim() || undefined } });
      setTextEn(r.text_en);
      setTextBm(r.text_bm);
    } catch (e: any) {
      setErr(e?.message ?? "AI generation failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
        </div>
        <AdminTabs current="promo" />
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">Hero Promo CTA</h1>
        <p className="mt-2 text-sm text-stone">
          Controls the promo pill on the homepage hero (next to the "Check availability" button).
          You can turn it on/off, edit the text in EN and BM, or auto-generate a fresh line with AI.
        </p>

        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        {loading ? (
          <p className="mt-8 text-sm text-stone">Loading…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
              <div>
                <div className="font-medium text-forest">Show promo CTA on homepage</div>
                <div className="text-xs text-stone">
                  When off, the hero pill is hidden for all visitors.
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-stone/30 peer-checked:bg-forest transition" />
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
              </label>
            </div>

            {/* AI generate */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg text-forest">Auto-generate with AI</h2>
              <p className="mt-1 text-xs text-stone">
                Optional hint (e.g. "focus on families", "mention weekend getaway"). Leave blank
                for a fresh generic line.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Optional hint for the AI…"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={generate}
                  disabled={busy !== null}
                  className="rounded-full bg-sand px-5 py-2 text-xs font-semibold uppercase tracking-widest text-forest disabled:opacity-50"
                >
                  {busy === "ai" ? "Generating…" : "✨ Generate"}
                </button>
              </div>
            </div>

            {/* Text fields */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg text-forest">CTA sentence</h2>
              <div className="mt-4 grid gap-4">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    English
                  </span>
                  <textarea
                    value={textEn}
                    onChange={(e) => setTextEn(e.target.value)}
                    rows={2}
                    maxLength={240}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-right text-[10px] text-stone">
                    {textEn.length}/240
                  </span>
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Bahasa Malaysia
                  </span>
                  <textarea
                    value={textBm}
                    onChange={(e) => setTextBm(e.target.value)}
                    rows={2}
                    maxLength={240}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-right text-[10px] text-stone">
                    {textBm.length}/240
                  </span>
                </label>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={busy !== null || textEn.trim().length < 3 || textBm.trim().length < 3}
                  className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                {savedMsg && <span className="text-xs text-green-700">{savedMsg}</span>}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}