import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listAdminRecipients,
  upsertAdminRecipient,
  deleteAdminRecipient,
  getAppSettings,
  updateAppSettings,
} from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

type R = {
  id?: string;
  email: string;
  label: string | null;
  notify_new_booking: boolean;
  notify_payment_proof: boolean;
  notify_fully_paid: boolean;
  is_active: boolean;
};

const emptyR: R = {
  email: "",
  label: "",
  notify_new_booking: true,
  notify_payment_proof: true,
  notify_fully_paid: true,
  is_active: true,
};

function SettingsPage() {
  const [recipients, setRecipients] = useState<R[]>([]);
  const [editing, setEditing] = useState<R | null>(null);
  const [settings, setSettings] = useState({ deposit_amount_default: 50, balance_due_days_before: 7 });
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    try {
      const rs = await listAdminRecipients();
      setRecipients(rs.recipients as R[]);
      const s = await getAppSettings();
      setSettings(s);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function saveR() {
    if (!editing) return;
    try {
      await upsertAdminRecipient({ data: editing });
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }
  async function delR(id: string) {
    if (!confirm("Remove this recipient?")) return;
    await deleteAdminRecipient({ data: { id } });
    load();
  }
  async function saveSettings() {
    try {
      await updateAppSettings({
        data: {
          deposit_amount_default: Number(settings.deposit_amount_default),
          balance_due_days_before: Number(settings.balance_due_days_before),
        },
      });
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 1500);
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
        <AdminTabs current="settings" />
      </header>
      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">Settings</h1>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        {/* Recipients */}
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-forest">Admin notification recipients</h2>
            <button onClick={() => setEditing({ ...emptyR })} className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut">
              + Add
            </button>
          </div>
          <p className="mt-1 text-xs text-stone">
            Each active recipient is CC'd on the matching booking notifications. At least one active recipient with the right flag is required, or notifications fall back to the project defaults.
          </p>
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-widest text-stone">
                <tr>
                  <th className="p-2">Email</th>
                  <th className="p-2">Label</th>
                  <th className="p-2 text-center">New booking</th>
                  <th className="p-2 text-center">Proof uploaded</th>
                  <th className="p-2 text-center">Fully paid</th>
                  <th className="p-2 text-center">Active</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-2">{r.email}</td>
                    <td className="p-2 text-xs">{r.label ?? "—"}</td>
                    <td className="p-2 text-center">{r.notify_new_booking ? "✓" : "—"}</td>
                    <td className="p-2 text-center">{r.notify_payment_proof ? "✓" : "—"}</td>
                    <td className="p-2 text-center">{r.notify_fully_paid ? "✓" : "—"}</td>
                    <td className="p-2 text-center">{r.is_active ? "✓" : "—"}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => setEditing({ ...r })} className="text-forest underline">edit</button>
                      <button onClick={() => r.id && delR(r.id)} className="ml-3 text-red-700 underline">delete</button>
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={7} className="p-3 text-center text-stone">No recipients.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {editing && (
            <div className="mt-4 rounded-lg border border-border/60 bg-coconut/40 p-4">
              <h3 className="text-sm font-medium">{editing.id ? "Edit recipient" : "New recipient"}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">Email</span>
                  <input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">Label (optional)</span>
                  <input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Check label="New booking" value={editing.notify_new_booking} onChange={(v) => setEditing({ ...editing, notify_new_booking: v })} />
                <Check label="Payment proof uploaded" value={editing.notify_payment_proof} onChange={(v) => setEditing({ ...editing, notify_payment_proof: v })} />
                <Check label="Fully paid" value={editing.notify_fully_paid} onChange={(v) => setEditing({ ...editing, notify_fully_paid: v })} />
                <Check label="Active" value={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={saveR} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut">Save</button>
                <button onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Payment settings */}
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg text-forest">Payment settings</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">Default deposit (RM)</span>
              <input type="number" value={settings.deposit_amount_default}
                onChange={(e) => setSettings({ ...settings, deposit_amount_default: Number(e.target.value) || 0 })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">Balance due (days before check-in)</span>
              <input type="number" value={settings.balance_due_days_before}
                onChange={(e) => setSettings({ ...settings, balance_due_days_before: Number(e.target.value) || 0 })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={saveSettings} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut">Save</button>
            {savedMsg && <span className="text-xs text-green-700">{savedMsg}</span>}
          </div>
        </div>
      </section>
    </main>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}