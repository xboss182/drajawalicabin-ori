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
import type { DiscountRow, DiscountScope, DiscountType } from "@/lib/discounts";

export const Route = createFileRoute("/_authenticated/admin/discounts")({
  head: () => ({
    meta: [
      { title: "Discounts — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscountsPage,
});

type FormState = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  type: DiscountType;
  value: number;
  nth_night_percent: number;
  active: boolean;
  starts_at: string;
  ends_at: string;
  stay_from: string;
  stay_to: string;
  min_nights: number;
  min_rooms: number;
  min_subtotal: number;
  cabin_types: string; // comma-separated in UI
  applies_to: DiscountScope;
  max_uses: string;
  max_uses_per_email: string;
  stackable: boolean;
};

const EMPTY: FormState = {
  id: null,
  code: "",
  name: "",
  description: "",
  type: "percent",
  value: 10,
  nth_night_percent: 50,
  active: true,
  starts_at: "",
  ends_at: "",
  stay_from: "",
  stay_to: "",
  min_nights: 1,
  min_rooms: 1,
  min_subtotal: 0,
  cabin_types: "",
  applies_to: "any",
  max_uses: "",
  max_uses_per_email: "",
  stackable: false,
};

const EMPTY_AUTO: FormState = { ...EMPTY, code: "" };
const EMPTY_COUPON: FormState = { ...EMPTY, code: "" };

type Mode = "coupon" | "auto";

function DiscountsPage() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [mode, setMode] = useState<Mode>("coupon");
  const [form, setForm] = useState<FormState>(EMPTY_COUPON);
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

  function editRow(row: DiscountRow) {
    setMode(row.code ? "coupon" : "auto");
    setForm({
      id: row.id,
      code: row.code ?? "",
      name: row.name,
      description: row.description ?? "",
      type: row.type,
      value: Number(row.value),
      nth_night_percent: Number(row.nth_night_percent ?? 50),
      active: row.active,
      starts_at: row.starts_at ? row.starts_at.slice(0, 10) : "",
      ends_at: row.ends_at ? row.ends_at.slice(0, 10) : "",
      stay_from: row.stay_from ?? "",
      stay_to: row.stay_to ?? "",
      min_nights: row.min_nights,
      min_rooms: row.min_rooms,
      min_subtotal: Number(row.min_subtotal),
      cabin_types: (row.cabin_types ?? []).join(", "),
      applies_to: row.applies_to,
      max_uses: row.max_uses == null ? "" : String(row.max_uses),
      max_uses_per_email: row.max_uses_per_email == null ? "" : String(row.max_uses_per_email),
      stackable: row.stackable,
    });
    setErr(null);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm(nextMode: Mode = mode) {
    setMode(nextMode);
    setForm({ ...(nextMode === "coupon" ? EMPTY_COUPON : EMPTY_AUTO) });
    setErr(null);
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {
        id: form.id ?? undefined,
        code: mode === "coupon" ? (form.code.trim() || null) : null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        value: Number(form.value),
        nth_night_percent: form.type === "nth_night" ? Number(form.nth_night_percent) : null,
        active: form.active,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        stay_from: form.stay_from || null,
        stay_to: form.stay_to || null,
        min_nights: Number(form.min_nights),
        min_rooms: Number(form.min_rooms),
        min_subtotal: Number(form.min_subtotal),
        cabin_types: form.cabin_types
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        applies_to: form.applies_to,
        max_uses: form.max_uses === "" ? null : Number(form.max_uses),
        max_uses_per_email: form.max_uses_per_email === "" ? null : Number(form.max_uses_per_email),
        stackable: form.stackable,
      };
      if (mode === "coupon" && !payload.code) {
        throw new Error("Coupon code is required for a coupon. Switch to Automatic rule if you want it auto-applied.");
      }
      await upsertDiscount({ data: payload });
      resetForm(mode);
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
    if (!confirm("Delete this discount? Redemption history will also be removed.")) return;
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

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">Discounts & coupons</h1>
        <p className="mt-2 text-sm text-stone">
          Create coupon codes (guest types them in) or automatic rules (silently applied). Discounts
          apply to the room rate only. When multiple qualify, the largest single discount wins unless
          you mark it stackable.
        </p>

        {err && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        {msg && <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

        {/* Mode switcher */}
        <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => { if (!form.id) resetForm("coupon"); else setMode("coupon"); }}
            className={`rounded-full px-4 py-1.5 uppercase tracking-widest ${mode === "coupon" ? "bg-forest text-coconut" : "text-stone"}`}
          >
            Coupon code
          </button>
          <button
            type="button"
            onClick={() => { if (!form.id) resetForm("auto"); else setMode("auto"); }}
            className={`rounded-full px-4 py-1.5 uppercase tracking-widest ${mode === "auto" ? "bg-forest text-coconut" : "text-stone"}`}
          >
            Automatic rule
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg text-forest">
            {form.id
              ? mode === "coupon" ? "Edit coupon code" : "Edit automatic rule"
              : mode === "coupon" ? "New coupon code" : "New automatic rule"}
          </h2>
          <p className="mt-1 text-xs text-stone">
            {mode === "coupon"
              ? "Guests type this code at checkout. Requires a code."
              : "Silently applied when the booking qualifies. No code needed."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name (internal)">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" placeholder="Merdeka 15%" />
            </Field>
            {mode === "coupon" && (
              <Field label="Code (guest types this)">
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="input" placeholder="RAYA25" />
              </Field>
            )}

            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })}
                className="input">
                <option value="percent">Percent off (room rate)</option>
                <option value="fixed">Fixed RM off (room rate)</option>
                <option value="nth_night">Nth night discount</option>
              </select>
            </Field>
            <Field label={form.type === "nth_night" ? "Which night (e.g. 2 = 2nd night)" : form.type === "percent" ? "Percent (0-100)" : "Amount RM"}>
              <input type="number" step="0.01" value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input" />
            </Field>

            {form.type === "nth_night" && (
              <Field label="% off that night (100 = free)">
                <input type="number" step="1" min={0} max={100} value={form.nth_night_percent}
                  onChange={(e) => setForm({ ...form, nth_night_percent: Number(e.target.value) })} className="input" />
              </Field>
            )}

            <Field label="Applies to nights">
              <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as DiscountScope })}
                className="input">
                <option value="any">Any night</option>
                <option value="weekday">Weekdays only (Mon-Thu)</option>
                <option value="weekend">Weekends only (Fri-Sun)</option>
                <option value="holiday">Public holidays only</option>
              </select>
            </Field>

            <Field label="Valid from (coupon window)">
              <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="input" />
            </Field>
            <Field label="Valid until (coupon window)">
              <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="input" />
            </Field>

            <Field label="Stay date from (check-in must fall in)">
              <input type="date" value={form.stay_from} onChange={(e) => setForm({ ...form, stay_from: e.target.value })} className="input" />
            </Field>
            <Field label="Stay date to">
              <input type="date" value={form.stay_to} onChange={(e) => setForm({ ...form, stay_to: e.target.value })} className="input" />
            </Field>

            <Field label="Min nights">
              <input type="number" min={1} value={form.min_nights}
                onChange={(e) => setForm({ ...form, min_nights: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Min rooms">
              <input type="number" min={1} value={form.min_rooms}
                onChange={(e) => setForm({ ...form, min_rooms: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Min room subtotal (RM)">
              <input type="number" step="0.01" min={0} value={form.min_subtotal}
                onChange={(e) => setForm({ ...form, min_subtotal: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Cabin types (comma-separated, blank = all)">
              <input value={form.cabin_types} onChange={(e) => setForm({ ...form, cabin_types: e.target.value })}
                className="input" placeholder="Twin, Queen" />
            </Field>

            <Field label="Max total uses (blank = unlimited)">
              <input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input" />
            </Field>
            <Field label="Max uses per guest email">
              <input value={form.max_uses_per_email} onChange={(e) => setForm({ ...form, max_uses_per_email: e.target.value })} className="input" />
            </Field>

            <Field label="Description (shown to guest on their booking)">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            {mode === "coupon" && (
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
                Stackable with automatic rule
              </label>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button disabled={busy} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut disabled:opacity-60">
              {busy ? "Saving…" : form.id ? "Save changes" : mode === "coupon" ? "Create coupon" : "Create rule"}
            </button>
            {form.id && (
              <button type="button" onClick={() => resetForm(mode)}
                className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone">
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {/* Coupon codes table */}
        <DiscountTable
          title="Coupon codes"
          rows={rows.filter((r) => !!r.code)}
          usageByDiscount={usageByDiscount}
          onEdit={editRow}
          onRemove={remove}
          onToggle={toggle}
          showCodeCol
        />

        {/* Automatic rules table */}
        <DiscountTable
          title="Automatic rules"
          rows={rows.filter((r) => !r.code)}
          usageByDiscount={usageByDiscount}
          onEdit={editRow}
          onRemove={remove}
          onToggle={toggle}
          showCodeCol={false}
        />

        <p className="mt-6 text-xs text-stone">
          Note: creating a discount here saves it, but the guest checkout flow needs to be wired next
          to actually apply it at booking time. Confirm when you're ready and I'll hook it into the
          booking + payment pages.
        </p>
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

function DiscountTable({
  title,
  rows,
  usageByDiscount,
  onEdit,
  onRemove,
  onToggle,
  showCodeCol,
}: {
  title: string;
  rows: DiscountRow[];
  usageByDiscount: Map<string, { count: number; total: number }>;
  onEdit: (r: DiscountRow) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  showCodeCol: boolean;
}) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl text-forest">{title} ({rows.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-coconut text-xs uppercase tracking-wider text-stone">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              {showCodeCol && <th className="px-3 py-2 text-left">Code</th>}
              <th className="px-3 py-2 text-left">Type / value</th>
              <th className="px-3 py-2 text-left">Window</th>
              <th className="px-3 py-2 text-right">Uses</th>
              <th className="px-3 py-2 text-right">Total off</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={showCodeCol ? 8 : 7} className="px-3 py-6 text-center text-stone">None yet.</td></tr>
            )}
            {rows.map((r) => {
              const usage = usageByDiscount.get(r.id) ?? { count: 0, total: 0 };
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.name}</td>
                  {showCodeCol && <td className="px-3 py-2 font-mono text-xs">{r.code}</td>}
                  <td className="px-3 py-2">
                    {r.type === "percent" && `${r.value}% off`}
                    {r.type === "fixed" && `RM${r.value} off`}
                    {r.type === "nth_night" && `Night #${r.value}: ${r.nth_night_percent}% off`}
                    <div className="text-xs text-stone">{r.applies_to !== "any" ? r.applies_to : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone">
                    {r.starts_at?.slice(0, 10) ?? "—"} → {r.ends_at?.slice(0, 10) ?? "—"}
                    {(r.stay_from || r.stay_to) && (
                      <div>stay {r.stay_from ?? "—"} → {r.stay_to ?? "—"}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{usage.count}{r.max_uses ? ` / ${r.max_uses}` : ""}</td>
                  <td className="px-3 py-2 text-right">RM{usage.total.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => onToggle(r.id, !r.active)}
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${r.active ? "bg-forest text-coconut" : "bg-stone/20 text-stone"}`}>
                      {r.active ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onEdit(r)} className="text-xs text-forest underline">Edit</button>{" "}
                    <button onClick={() => onRemove(r.id)} className="ml-2 text-xs text-red-700 underline">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
