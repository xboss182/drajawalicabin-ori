import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminTabs } from "./admin";
import {
  listDiscounts,
  upsertDiscount,
  deleteDiscount,
  toggleDiscountActive,
  listRedemptions,
  type RedemptionRow,
} from "@/lib/discounts.functions";
import type { DiscountRow } from "@/lib/discounts";

export const Route = createFileRoute("/_authenticated/admin/discounts")({
  head: () => ({
    meta: [
      { title: "Discounts — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscountsPage,
});

type Mode = "coupon" | "auto";

// The one automatic rule we support: 10% off every night from the 2nd onwards, per room.
const AUTO_RULE_NAME = "10% off 2nd night onwards (per room)";
function autoRulePayload(active: boolean) {
  return {
    code: null,
    name: AUTO_RULE_NAME,
    description: "Auto-applied: every night from the 2nd onwards gets 10% off, per room.",
    type: "nth_night_onwards" as const,
    value: 2,
    nth_night_percent: 10,
    active,
    starts_at: null,
    ends_at: null,
    stay_from: null,
    stay_to: null,
    min_nights: 2,
    min_rooms: 1,
    min_subtotal: 0,
    cabin_types: [] as string[],
    applies_to: "any" as const,
    max_uses: null,
    max_uses_per_email: null,
    stackable: false,
  };
}

type CouponForm = {
  id: string | null;
  code: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  max_uses: number | null;
};

const EMPTY_COUPON: CouponForm = {
  id: null,
  code: "",
  name: "",
  type: "percent",
  value: 10,
  active: true,
  max_uses: null,
};

function DiscountsPage() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [mode, setMode] = useState<Mode>("coupon");
  const [form, setForm] = useState<CouponForm>(EMPTY_COUPON);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [d, r] = await Promise.all([listDiscounts(), listRedemptions()]);
      setRows(d);
      setRedemptions(r);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const usageByDiscount = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const r of redemptions) {
      const prev = map.get(r.discount_id) ?? { count: 0, total: 0 };
      prev.count += 1;
      prev.total += Number(r.amount_off ?? 0);
      map.set(r.discount_id, prev);
    }
    return map;
  }, [redemptions]);

  const coupons = rows.filter((r) => !!r.code);
  const autoRule = rows.find((r) => !r.code) ?? null;

  function editCoupon(row: DiscountRow) {
    setMode("coupon");
    setForm({
      id: row.id,
      code: row.code ?? "",
      name: row.name,
      type: row.type === "fixed" ? "fixed" : "percent",
      value: Number(row.value),
      active: row.active,
      max_uses: row.max_uses ?? null,
    });
    setErr(null);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!form.code.trim()) throw new Error("Coupon code is required.");
      if (!form.name.trim()) throw new Error("Name is required.");
      await upsertDiscount({
        data: {
          id: form.id ?? undefined,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: null,
          type: form.type,
          value: Number(form.value),
          nth_night_percent: null,
          active: form.active,
          starts_at: null,
          ends_at: null,
          stay_from: null,
          stay_to: null,
          min_nights: 1,
          min_rooms: 1,
          min_subtotal: 0,
          cabin_types: [],
          applies_to: "any",
          max_uses: form.max_uses && form.max_uses > 0 ? form.max_uses : null,
          max_uses_per_email: null,
          stackable: false,
        },
      });
      setForm(EMPTY_COUPON);
      setMsg("Saved");
      await load();
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    try {
      await deleteDiscount({ data: { id } });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await toggleDiscountActive({ data: { id, active } });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }

  async function createAutoRule() {
    setBusy(true);
    setErr(null);
    try {
      await upsertDiscount({ data: autoRulePayload(true) });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
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
        <AdminTabs current="discounts" />
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">Discounts</h1>
        <p className="mt-2 text-sm text-stone">
          Applies to room rate only. Best-one-wins if a coupon and the auto rule both qualify.
        </p>

        {err && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        {msg && <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

        <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1 text-xs">
          <button type="button" onClick={() => setMode("coupon")}
            className={`rounded-full px-4 py-1.5 uppercase tracking-widest ${mode === "coupon" ? "bg-forest text-coconut" : "text-stone"}`}>
            Coupon codes
          </button>
          <button type="button" onClick={() => setMode("auto")}
            className={`rounded-full px-4 py-1.5 uppercase tracking-widest ${mode === "auto" ? "bg-forest text-coconut" : "text-stone"}`}>
            Automatic rule
          </button>
        </div>

        {mode === "coupon" ? (
          <>
            <form onSubmit={submitCoupon} className="mt-4 rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg text-forest">{form.id ? "Edit coupon" : "New coupon"}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Name (internal)">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input" placeholder="Merdeka promo" />
                </Field>
                <Field label="Code (guest types this)">
                  <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="input" placeholder="RAYA25" />
                </Field>
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
                    className="input">
                    <option value="percent">% off</option>
                    <option value="fixed">RM off</option>
                  </select>
                </Field>
                <Field label={form.type === "percent" ? "Percent (0-100)" : "Amount (RM)"}>
                  <input type="number" step="0.01" min={0} value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input" />
                </Field>
                <Field label="Usage limit (blank = unlimited)">
                  <input type="number" min={0} step={1}
                    value={form.max_uses ?? ""}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))) })}
                    className="input" placeholder="e.g. 50" />
                </Field>
              </div>
              <label className="mt-4 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
              <div className="mt-5 flex gap-2">
                <button disabled={busy} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut disabled:opacity-60">
                  {busy ? "Saving…" : form.id ? "Save changes" : "Create coupon"}
                </button>
                {form.id && (
                  <button type="button" onClick={() => setForm(EMPTY_COUPON)}
                    className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone">
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-10">
              <h2 className="font-display text-xl text-forest">Coupon codes ({coupons.length})</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-coconut text-xs uppercase tracking-wider text-stone">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Value</th>
                      <th className="px-3 py-2 text-right">Uses</th>
                      <th className="px-3 py-2 text-right">Limit</th>
                      <th className="px-3 py-2 text-right">Total off</th>
                      <th className="px-3 py-2 text-center">Active</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-6 text-center text-stone">No coupons yet.</td></tr>
                    )}
                    {coupons.map((r) => {
                      const u = usageByDiscount.get(r.id) ?? { count: 0, total: 0 };
                      const limit = r.max_uses ?? null;
                      const reached = limit != null && u.count >= limit;
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                          <td className="px-3 py-2">{r.type === "percent" ? `${r.value}% off` : `RM${r.value} off`}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={reached ? "text-red-700 font-medium" : ""}>{u.count}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{limit ?? "∞"}</td>
                          <td className="px-3 py-2 text-right">RM{u.total.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => toggle(r.id, !r.active)}
                              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${r.active ? "bg-forest text-coconut" : "bg-stone/20 text-stone"}`}>
                              {r.active ? "On" : "Off"}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => editCoupon(r)} className="text-xs text-forest underline">Edit</button>{" "}
                            <button onClick={() => remove(r.id)} className="ml-2 text-xs text-red-700 underline">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg text-forest">Automatic rule</h2>
            <p className="mt-2 text-sm text-stone">
              <strong>10% off every night from the 2nd night onwards, per room.</strong><br />
              Silently applied at checkout when the booking qualifies (2+ nights). No code needed.
            </p>
            {autoRule ? (
              <div className="mt-5 flex items-center gap-4">
                <button onClick={() => toggle(autoRule.id, !autoRule.active)}
                  className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-widest ${autoRule.active ? "bg-forest text-coconut" : "bg-stone/20 text-stone"}`}>
                  {autoRule.active ? "On" : "Off"}
                </button>
                <span className="text-xs text-stone">
                  {(usageByDiscount.get(autoRule.id)?.count ?? 0)} uses ·
                  RM{(usageByDiscount.get(autoRule.id)?.total ?? 0).toFixed(2)} total off
                </span>
              </div>
            ) : (
              <button onClick={createAutoRule} disabled={busy}
                className="mt-5 rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut disabled:opacity-60">
                {busy ? "Creating…" : "Enable this rule"}
              </button>
            )}
          </div>
        )}
      </section>

      <style>{`
        .input {
          margin-top: 4px;
          width: 100%;
          border-radius: 6px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 8px 12px;
          font-size: 13px;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-stone">{label}</span>
      {children}
    </label>
  );
}