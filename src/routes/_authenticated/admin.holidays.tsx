import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listHolidays, upsertHoliday, deleteHoliday } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/holidays")({
  head: () => ({ meta: [{ title: "Holidays — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: HolidaysPage,
});

type H = { id?: string; label: string; starts_on: string; ends_on: string };

function HolidaysPage() {
  const [rows, setRows] = useState<H[]>([]);
  const [editing, setEditing] = useState<H | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await listHolidays();
      setRows(r.holidays as H[]);
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
      await upsertHoliday({ data: editing });
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }
  async function del(id: string) {
    if (!confirm("Delete this holiday range?")) return;
    await deleteHoliday({ data: { id } });
    load();
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
        <AdminTabs current="holidays" />
      </header>
      <section className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-forest">School holidays</h1>
          <button
            onClick={() => setEditing({ label: "", starts_on: "", ends_on: "" })}
            className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut"
          >
            + Add range
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        <div className="mt-6 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
              <tr>
                <th className="p-2">Label</th>
                <th className="p-2">Starts</th>
                <th className="p-2">Ends</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.starts_on}</td>
                  <td className="p-2">{r.ends_on}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => setEditing({ ...r })} className="text-forest underline">edit</button>
                    <button onClick={() => r.id && del(r.id)} className="ml-3 text-red-700 underline">delete</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-stone">No holiday ranges yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-forest">{editing.id ? "Edit holiday" : "New holiday"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3">
                <span className="block text-[10px] uppercase tracking-widest text-stone">Label</span>
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-stone">Starts</span>
                <input type="date" value={editing.starts_on} onChange={(e) => setEditing({ ...editing, starts_on: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-stone">Ends</span>
                <input type="date" value={editing.ends_on} onChange={(e) => setEditing({ ...editing, ends_on: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={save} className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut">Save</button>
              <button onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone">Cancel</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}