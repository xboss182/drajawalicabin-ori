import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/store")({
  head: () => ({
    meta: [{ title: "Store — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }],
  }),
  component: StoreAdminPage,
});

type Row = {
  id: string;
  name_en: string;
  name_bm: string;
  description_en: string | null;
  description_bm: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

const UNITS = ["per stay", "per night", "per hour", "per item"];

function StoreAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("store_items").select("*").order("display_order");
    if (error) return setErr(error.message);
    setRows(
      ((data ?? []) as Row[]).map((row) => ({
        ...row,
        price: Number(row.price),
      })),
    );

    const { data: s } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_booking")
      .maybeSingle();
    const cfg = (s?.value ?? {}) as Record<string, unknown>;
    if (typeof cfg.phone === "string" && cfg.phone) setPhone(cfg.phone);
    if (typeof cfg.enabled === "boolean") setEnabled(cfg.enabled);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 1500);
  }

  async function saveConfig() {
    const digits = phone.replace(/\D/g, "");
    if (enabled && (digits.length < 8 || digits.length > 15)) {
      setErr("Enter a valid dedicated WhatsApp number before enabling booking.");
      return;
    }
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "whatsapp_booking", value: { phone: digits, enabled } },
        { onConflict: "key" },
      );
    if (error) return setErr(error.message);
    setPhone(digits);
    flash("Saved");
  }

  async function addItem() {
    const { error } = await supabase.from("store_items").insert({
      name_en: "New item",
      name_bm: "Barang baharu",
      price: 0,
      unit: "per stay",
      display_order: rows.length + 1,
      is_active: false,
    });
    if (error) return setErr(error.message);
    await load();
  }

  async function updateItem(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("store_items").update(patch).eq("id", id);
    if (error) setErr(error.message);
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("store_items").delete().eq("id", id);
    if (error) return setErr(error.message);
    await load();
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
          <a
            href="/whatsapp-store"
            target="_blank"
            rel="noreferrer"
            className="text-xs uppercase tracking-widest text-stone hover:text-forest"
          >
            View store ↗
          </a>
        </div>
        <AdminTabs current="store" />
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <h1 className="font-display text-3xl text-forest">WhatsApp store</h1>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg text-forest">Store settings</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-stone">
                Orders go to WhatsApp number
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Country code and phone number"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Store is open
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={saveConfig}
              className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut"
            >
              Save
            </button>
            {msg && <span className="text-xs text-green-700">{msg}</span>}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-lg text-forest">Add-on items</h2>
          <button
            onClick={addItem}
            className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut"
          >
            + Add item
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Name (EN)
                  </span>
                  <input
                    value={r.name_en}
                    onChange={(e) => updateItem(r.id, { name_en: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Name (BM)
                  </span>
                  <input
                    value={r.name_bm}
                    onChange={(e) => updateItem(r.id, { name_bm: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Description (EN)
                  </span>
                  <input
                    value={r.description_en ?? ""}
                    onChange={(e) => updateItem(r.id, { description_en: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Description (BM)
                  </span>
                  <input
                    value={r.description_bm ?? ""}
                    onChange={(e) => updateItem(r.id, { description_bm: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Price (RM)
                  </span>
                  <input
                    type="number"
                    value={r.price}
                    onChange={(e) => updateItem(r.id, { price: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Unit
                  </span>
                  <select
                    value={r.unit}
                    onChange={(e) => updateItem(r.id, { unit: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Image URL (optional)
                  </span>
                  <input
                    value={r.image_url ?? ""}
                    onChange={(e) => updateItem(r.id, { image_url: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    Sort order
                  </span>
                  <input
                    type="number"
                    value={r.display_order}
                    onChange={(e) =>
                      updateItem(r.id, { display_order: Number(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) => updateItem(r.id, { is_active: e.target.checked })}
                  />
                  In stock / visible
                </label>
                <button
                  onClick={() => removeItem(r.id)}
                  className="text-xs uppercase tracking-widest text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
