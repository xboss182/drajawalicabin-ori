import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listHolidays, upsertHoliday, deleteHoliday, previewHolidaySeed, importHolidays } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/holidays")({
  head: () => ({ meta: [{ title: "Holidays — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: HolidaysPage,
});

type H = {
  id?: string;
  label: string;
  starts_on: string;
  ends_on: string;
  kind: "public_holiday" | "school_break";
};

type PreviewRow = H & { status: "new" | "duplicate" | "overlap"; note?: string };

function HolidaysPage() {
  const [rows, setRows] = useState<H[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
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

  async function populate() {
    setBusy(true);
    try {
      const r = await previewHolidaySeed();
      const list = r.rows as PreviewRow[];
      setPreview(list);
      setSelected(
        new Set(list.map((x, i) => (x.status === "new" ? i : -1)).filter((i) => i >= 0)),
      );
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function approveImport() {
    if (!preview || selected.size === 0) return;
    setBusy(true);
    try {
      const chosen = preview
        .filter((_, i) => selected.has(i))
        .map(({ label, starts_on, ends_on, kind }) => ({ label, starts_on, ends_on, kind }));
      const r = await importHolidays({ data: { rows: chosen } });
      alert(`Added ${r.inserted} holidays (skipped ${r.skipped} existing).`);
      setPreview(null);
      setSelected(new Set());
      load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
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
          <h1 className="font-display text-3xl text-forest">Holidays</h1>
          <div className="flex gap-2">
            <button
              onClick={populate}
              className="rounded-full border border-forest px-4 py-1.5 text-xs uppercase tracking-widest text-forest"
            >
              {busy && !preview ? "Loading…" : "Populate through 2027"}
            </button>
            <button
              onClick={() =>
                setEditing({ label: "", starts_on: "", ends_on: "", kind: "public_holiday" })
              }
              className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut"
            >
              + Add range
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone">
          Public holidays are charged at the weekend rate. School breaks are charged at the school
          holiday rate.
        </p>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

        <div className="mt-6 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
              <tr>
                <th className="p-2">Label</th>
                <th className="p-2">Type</th>
                <th className="p-2">Starts</th>
                <th className="p-2">Ends</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.kind === "public_holiday"
                          ? "bg-red-100 text-red-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {r.kind === "public_holiday" ? "Public holiday" : "School break"}
                    </span>
                  </td>
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
                  <td colSpan={5} className="p-3 text-center text-stone">No holiday ranges yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {preview && (
          <div className="mt-6 rounded-xl border border-forest/40 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-forest">Review imported dates</h2>
                <p className="mt-1 text-xs text-stone">
                  Nothing affects pricing or availability until you approve. Tick the rows you
                  want to add — {selected.size} of {preview.length} selected.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(preview.map((_, i) => i)))}
                  className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest text-stone"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest text-stone"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-coconut text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="w-10 px-2 py-2" />
                    <th className="w-[38%] px-2 py-2 text-left">Holiday</th>
                    <th className="w-[28%] px-2 py-2 text-left">Dates</th>
                    <th className="px-2 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={`${r.label}-${r.starts_on}`} className="border-t border-border align-top">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggle(i)}
                          disabled={r.status === "duplicate"}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-forest">{r.label}</div>
                        <div className="text-[10px] uppercase tracking-widest text-stone">
                          {r.kind === "public_holiday" ? "Weekend rate" : "Holiday rate"}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-stone">
                        {r.starts_on}{r.ends_on !== r.starts_on ? ` → ${r.ends_on}` : ""}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={
                            r.status === "new"
                              ? "text-forest"
                              : r.status === "overlap"
                                ? "text-amber-600"
                                : "text-stone"
                          }
                        >
                          {r.status === "new" ? "New" : r.status === "overlap" ? "Overlap" : "Already added"}
                        </span>
                        {r.note && <div className="text-[11px] text-stone">{r.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={approveImport}
                disabled={busy || selected.size === 0}
                className="rounded-full bg-forest px-5 py-2 text-xs uppercase tracking-widest text-coconut disabled:opacity-50"
              >
                {busy ? "Importing…" : `Approve & import ${selected.size}`}
              </button>
              <button
                onClick={() => { setPreview(null); setSelected(new Set()); }}
                className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
              <label className="block sm:col-span-3">
                <span className="block text-[10px] uppercase tracking-widest text-stone">
                  Type
                </span>
                <select
                  value={editing.kind}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      kind: e.target.value as "public_holiday" | "school_break",
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="public_holiday">Public holiday — weekend rate</option>
                  <option value="school_break">School break — holiday rate</option>
                </select>
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