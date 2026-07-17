import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getHeroPromoCta,
  updateHeroPromoCta,
  generatePromoCtaAi,
  type PromoCtaItem,
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
  const [items, setItems] = useState<PromoCtaItem[]>([]);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "ai">(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "bm">("en");

  useEffect(() => {
    (async () => {
      try {
        const s = await getHeroPromoCta();
        setItems(s.items);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patch(id: string, patch: Partial<PromoCtaItem>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) return { ...it, ...patch };
        // Enforce single-enabled: turning one on turns others off.
        if (patch.enabled === true) return { ...it, enabled: false };
        return it;
      }),
    );
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function addPreset() {
    setItems((prev) => [
      ...prev,
      {
        id: `cta_${Date.now().toString(36)}`,
        enabled: true,
        text_en: "Stay longer, save more — 10% off from your 2nd night onwards. Auto-applied.",
        text_bm:
          "Menginap lebih lama, jimat lebih banyak — Diskaun 10% mulai malam ke-2 dan seterusnya. Dikenakan secara automatik.",
      },
    ]);
  }

  async function save() {
    setErr(null);
    setBusy("save");
    try {
      const cleaned = items
        .map((it) => ({
          ...it,
          text_en: it.text_en.trim(),
          text_bm: it.text_bm.trim(),
        }))
        .filter((it) => it.text_en.length >= 3 && it.text_bm.length >= 3);
      if (cleaned.length === 0) {
        setErr("At least one CTA with EN + BM text is required.");
        return;
      }
      await updateHeroPromoCta({ data: { items: cleaned } });
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
      setItems((prev) => [...prev, r]);
    } catch (e: any) {
      setErr(e?.message ?? "AI generation failed");
    } finally {
      setBusy(null);
    }
  }

  const activeCount = items.filter((i) => i.enabled).length;

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
          Manage multiple promo CTAs shown on the homepage hero. Toggle each on/off, delete,
          or generate new ones with AI. The homepage shows the first enabled CTA.
        </p>
        <p className="mt-1 text-xs text-stone">
          {items.length} total · {activeCount} enabled
        </p>

        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        {loading ? (
          <p className="mt-8 text-sm text-stone">Loading…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Live preview */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-forest">Homepage preview</h2>
                <div className="flex gap-1 rounded-full border border-border p-1 text-[10px] uppercase tracking-widest">
                  <button
                    onClick={() => setPreviewLang("en")}
                    className={`rounded-full px-3 py-1 ${previewLang === "en" ? "bg-forest text-coconut" : "text-stone"}`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setPreviewLang("bm")}
                    className={`rounded-full px-3 py-1 ${previewLang === "bm" ? "bg-forest text-coconut" : "text-stone"}`}
                  >
                    BM
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-stone">
                Shows the first enabled CTA as it will appear on the hero. Changes reflect after
                you Save.
              </p>
              <div className="mt-4 rounded-2xl bg-forest/90 p-6">
                {(() => {
                  const active = items.find((i) => i.enabled);
                  if (!active) {
                    return (
                      <p className="text-center text-xs uppercase tracking-widest text-coconut/70">
                        No enabled CTA — pill hidden on homepage
                      </p>
                    );
                  }
                  const text = previewLang === "bm" ? active.text_bm : active.text_en;
                  return (
                    <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-3xl border border-sand/50 bg-forest/40 px-6 py-3.5 text-lg leading-snug text-coconut shadow-lg backdrop-blur-md">
                      <span className="text-sand">✦</span>
                      <span className="text-sand">{text}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* AI generate */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg text-forest">Auto-generate with AI</h2>
              <p className="mt-1 text-xs text-stone">
                Adds a new CTA to the list below (enabled by default).
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
              <button
                onClick={addPreset}
                className="mt-3 rounded-full border border-forest/30 px-4 py-1.5 text-[11px] uppercase tracking-widest text-forest hover:bg-forest hover:text-coconut"
              >
                + Add "Stay longer, save more" preset
              </button>
            </div>

            {/* Items list */}
            <div className="space-y-4">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-forest">CTA #{idx + 1}</div>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={it.enabled}
                          onChange={(e) => patch(it.id, { enabled: e.target.checked })}
                          className="peer sr-only"
                        />
                        <div className="h-6 w-11 rounded-full bg-stone/30 peer-checked:bg-forest transition" />
                        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                      </label>
                      <span className="text-[10px] uppercase tracking-widest text-stone">
                        {it.enabled ? "On" : "Off"}
                      </span>
                      <button
                        onClick={() => remove(it.id)}
                        className="rounded-full border border-red-200 px-3 py-1 text-[10px] uppercase tracking-widest text-red-700 hover:bg-red-50"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="block text-[10px] uppercase tracking-widest text-stone">
                        English
                      </span>
                      <textarea
                        value={it.text_en}
                        onChange={(e) => patch(it.id, { text_en: e.target.value })}
                        rows={2}
                        maxLength={240}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block text-right text-[10px] text-stone">
                        {it.text_en.length}/240
                      </span>
                    </label>
                    <label className="block">
                      <span className="block text-[10px] uppercase tracking-widest text-stone">
                        Bahasa Malaysia
                      </span>
                      <textarea
                        value={it.text_bm}
                        onChange={(e) => patch(it.id, { text_bm: e.target.value })}
                        rows={2}
                        maxLength={240}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block text-right text-[10px] text-stone">
                        {it.text_bm.length}/240
                      </span>
                    </label>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-stone">No CTAs yet — generate one above.</p>
              )}
            </div>

            <div className="sticky bottom-4 flex items-center gap-3 rounded-full bg-card/95 p-2 backdrop-blur">
              <button
                onClick={save}
                disabled={busy !== null}
                className="rounded-full bg-forest px-6 py-2.5 text-xs uppercase tracking-widest text-coconut disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save all"}
              </button>
              {savedMsg && <span className="text-xs text-green-700">{savedMsg}</span>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
