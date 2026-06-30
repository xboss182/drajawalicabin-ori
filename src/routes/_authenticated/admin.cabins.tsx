import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listCabinsAdmin, upsertCabin, setCabinActive } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/cabins")({
  head: () => ({ meta: [{ title: "Cabins — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: CabinsPage,
});

type Cabin = {
  id?: string;
  name: string;
  slug: string;
  cabin_type: string;
  capacity: number;
  weekday_rate: number;
  weekend_rate: number;
  school_holiday_rate: number;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

const empty: Cabin = {
  name: "",
  slug: "",
  cabin_type: "",
  capacity: 2,
  weekday_rate: 0,
  weekend_rate: 0,
  school_holiday_rate: 0,
  description: "",
  display_order: 0,
  is_active: true,
};

function CabinsPage() {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [editing, setEditing] = useState<Cabin | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await listCabinsAdmin();
      setCabins(r.cabins as Cabin[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing) return;
    try {
      await upsertCabin({
        data: {
          ...editing,
          description: editing.description ?? null,
          capacity: Number(editing.capacity),
          weekday_rate: Number(editing.weekday_rate),
          weekend_rate: Number(editing.weekend_rate),
          school_holiday_rate: Number(editing.school_holiday_rate),
          display_order: Number(editing.display_order),
        },
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }

  async function toggleActive(c: Cabin) {
    if (!c.id) return;
    await setCabinActive({ data: { id: c.id, active: !c.is_active } });
    load();
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
        <AdminTabs current="cabins" />
      </header>
      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-forest">Cabins & rates</h1>
          <button
            onClick={() => setEditing({ ...empty })}
            className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut"
          >
            + New cabin
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        <div className="mt-6 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Cap.</th>
                <th className="p-2 text-right">Weekday</th>
                <th className="p-2 text-right">Weekend</th>
                <th className="p-2 text-right">Holiday</th>
                <th className="p-2">Order</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {cabins.map((c) => (
                <tr key={c.id} className="border-t border-border/40">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 text-xs">{c.cabin_type}</td>
                  <td className="p-2">{c.capacity}</td>
                  <td className="p-2 text-right">RM {Number(c.weekday_rate).toFixed(0)}</td>
                  <td className="p-2 text-right">RM {Number(c.weekend_rate).toFixed(0)}</td>
                  <td className="p-2 text-right">RM {Number(c.school_holiday_rate).toFixed(0)}</td>
                  <td className="p-2">{c.display_order}</td>
                  <td className="p-2">
                    <span className={c.is_active ? "text-green-700" : "text-stone"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => setEditing({ ...c })} className="text-forest underline">
                      edit
                    </button>
                    <button onClick={() => toggleActive(c)} className="ml-3 text-stone underline">
                      {c.is_active ? "disable" : "enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-forest">{editing.id ? "Edit cabin" : "New cabin"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Slug" value={editing.slug} onChange={(v) => setEditing({ ...editing, slug: v })} />
              <Field label="Cabin type" value={editing.cabin_type} onChange={(v) => setEditing({ ...editing, cabin_type: v })} />
              <Field label="Capacity" type="number" value={String(editing.capacity)} onChange={(v) => setEditing({ ...editing, capacity: Number(v) || 1 })} />
              <Field label="Weekday rate (RM)" type="number" value={String(editing.weekday_rate)} onChange={(v) => setEditing({ ...editing, weekday_rate: Number(v) || 0 })} />
              <Field label="Weekend rate (RM)" type="number" value={String(editing.weekend_rate)} onChange={(v) => setEditing({ ...editing, weekend_rate: Number(v) || 0 })} />
              <Field label="School holiday rate (RM)" type="number" value={String(editing.school_holiday_rate)} onChange={(v) => setEditing({ ...editing, school_holiday_rate: Number(v) || 0 })} />
              <Field label="Display order" type="number" value={String(editing.display_order)} onChange={(v) => setEditing({ ...editing, display_order: Number(v) || 0 })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active
              </label>
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-widest text-stone">Description</label>
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={save} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut">
                Save
              </button>
              <button onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-stone">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}