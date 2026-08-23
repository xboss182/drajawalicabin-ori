import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getAppSettings, updateAppSettings } from "@/lib/booking.functions";
import { getWaAdminSettings, updateWaAdminSettings } from "@/lib/wa-admin.functions";

import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState({
    deposit_amount_default: 50,
    balance_due_days_before: 7,
  });
  const [whatsapp, setWhatsapp] = useState({
    phone: "",
    enabled: false,
    paymentTextEn: "",
    paymentTextBm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);

  function showSaved(message: string) {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(null), 1500);
  }

  async function load() {
    try {
      const [appSettings, whatsAppSettings] = await Promise.all([
        getAppSettings(),
        getWaAdminSettings(),
      ]);
      setSettings(appSettings);
      setWhatsapp(whatsAppSettings);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load settings");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings() {
    try {
      await updateAppSettings({
        data: {
          deposit_amount_default: Number(settings.deposit_amount_default),
          balance_due_days_before: Number(settings.balance_due_days_before),
        },
      });
      showSaved("Payment settings saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save payment settings");
    }
  }

  async function saveWhatsApp() {
    setSavingWhatsApp(true);
    setError(null);
    try {
      await updateWaAdminSettings({ data: whatsapp });
      showSaved("WhatsApp settings saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save WhatsApp settings");
    } finally {
      setSavingWhatsApp(false);
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">
            Rajawali D&apos;Cabin
          </Link>
        </div>
        <AdminTabs current="settings" />
      </header>
      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">Settings</h1>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {savedMessage && (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {savedMessage}
          </p>
        )}

        <p className="mt-2 text-sm text-stone">
          Manage admin members and notification recipients under{" "}
          <Link to="/admin/members" className="text-forest underline">
            Members
          </Link>
          .
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg text-forest">Payment settings</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">
                Default security deposit per room (RM)
              </span>
              <input
                type="number"
                value={settings.deposit_amount_default}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    deposit_amount_default: Number(event.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">
                Balance due (days before check-in)
              </span>
              <input
                type="number"
                value={settings.balance_due_days_before}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    balance_due_days_before: Number(event.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveSettings()}
            className="mt-4 rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Save payment settings
          </button>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone">Chat-native booking</p>
          <h2 className="mt-1 font-display text-lg text-forest">WhatsApp booking</h2>
          <p className="mt-2 text-sm text-stone">
            The public site opens only this configured number with the minimal <strong>Book</strong>{" "}
            message. Customers choose all booking details in WhatsApp.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">
                Dedicated WhatsApp number
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={whatsapp.phone}
                onChange={(event) => setWhatsapp({ ...whatsapp, phone: event.target.value })}
                placeholder="60123456789"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-coconut/60 p-3 text-sm">
              <input
                name="whatsapp-booking-enabled"
                type="checkbox"
                checked={whatsapp.enabled}
                onChange={(event) => setWhatsapp({ ...whatsapp, enabled: event.target.checked })}
                className="mt-0.5 size-4 accent-forest"
              />
              <span>
                <strong>Enable public Book in WhatsApp links</strong>
                <br />
                <span className="text-stone">
                  Keep disabled until the dedicated number is approved and paired.
                </span>
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-stone">
                  Approved payment instructions (English)
                </span>
                <textarea
                  value={whatsapp.paymentTextEn}
                  onChange={(event) =>
                    setWhatsapp({
                      ...whatsapp,
                      paymentTextEn: event.target.value,
                    })
                  }
                  rows={5}
                  placeholder="Payment instructions shown after a WhatsApp hold is created…"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-stone">
                  Arahan bayaran diluluskan (Bahasa Malaysia)
                </span>
                <textarea
                  value={whatsapp.paymentTextBm}
                  onChange={(event) =>
                    setWhatsapp({
                      ...whatsapp,
                      paymentTextBm: event.target.value,
                    })
                  }
                  rows={5}
                  placeholder="Arahan bayaran selepas pegangan tempahan WhatsApp…"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveWhatsApp()}
              disabled={savingWhatsApp}
              className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60"
            >
              {savingWhatsApp ? "Saving…" : "Save WhatsApp settings"}
            </button>
            <Link
              to="/admin/whatsapp"
              className="text-xs uppercase tracking-widest text-forest underline"
            >
              Open operations queue
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
