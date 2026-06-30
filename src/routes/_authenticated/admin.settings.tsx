import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getAppSettings,
  updateAppSettings,
} from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState({ deposit_amount_default: 50, balance_due_days_before: 7 });
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    try {
      const s = await getAppSettings();
      setSettings(s);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

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

        <p className="mt-2 text-sm text-stone">
          Manage admin members and notification recipients under <Link to="/admin/members" className="underline text-forest">Members</Link>.
        </p>

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