import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { AdminTabs } from "./admin";
import {
  rebuildCrmGuests,
  listGuests,
  getGuest,
  updateGuest,
  editBooking,
  createTask,
  toggleTask,
  deleteTask,
  listAllTags,
  listCabins,
  listBookingsByDate,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  head: () => ({ meta: [{ title: "CRM — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: CrmPage,
});

type Guest = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  total_bookings: number;
  total_nights: number;
  total_spent: number;
  last_stay_at: string | null;
  first_seen_at: string;
  tags: string[];
  notes: string | null;
  marketing_opt_in: boolean;
};

function CrmPage() {
  const [tab, setTab] = useState<"by_date" | "guests">("by_date");
  const [rows, setRows] = useState<Guest[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"last_stay" | "spent" | "bookings" | "name">("last_stay");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookingsFor, setBookingsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function load(overrideSearch?: string) {
    setLoading(true);
    setErr(null);
    try {
      const s = overrideSearch !== undefined ? overrideSearch : search;
      const r = await listGuests({ data: { search: s || undefined, tag: tag || undefined, sort, limit: 100 } });
      setRows(r.rows as Guest[]);
      setCount(r.count);
      const t = await listAllTags();
      setTags(t.tags);
      return r.rows as Guest[];
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
      return [] as Guest[];
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sort, tag]);

  async function openGuestByEmail(email: string, name?: string | null) {
    const isManual = email.toLowerCase() === "manual@admin.local";
    const searchTerm = isManual ? (name ?? "") : email;
    setTab("guests");
    setPendingEmail(searchTerm || email);
    setSearch(searchTerm);
    await load(searchTerm);
    // Do not auto-open Edit info or Bookings — user must click explicitly.
    setSelectedId(null);
    setBookingsFor(null);
    setPendingEmail(null);
  }

  async function sync() {
    setStatus("Syncing guest profiles…");
    try {
      const r = await rebuildCrmGuests();
      setStatus(`Synced ${r.synced} guest profile(s).`);
      await load();
    } catch (e: any) {
      setStatus(null);
      alert(e?.message ?? "Failed");
    }
    setTimeout(() => setStatus(null), 4000);
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
        <AdminTabs current="crm" />
      </header>
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-forest">CRM</h1>
          <button onClick={sync} className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut">
            Sync from bookings
          </button>
        </div>
        {status && <p className="mt-2 text-sm text-forest">{status}</p>}
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}

        <div className="mt-4 flex gap-1 border-b border-border">
          {(["by_date", "guests"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs uppercase tracking-widest ${tab === t ? "border-b-2 border-forest text-forest" : "text-stone"}`}>
              {t === "by_date" ? "By date" : "Guests"}
            </button>
          ))}
        </div>

        {tab === "by_date" && <ByDatePanel onOpenGuest={openGuestByEmail} />}
        {pendingEmail && tab === "guests" && (
          <p className="mt-2 text-xs text-stone">Opening {pendingEmail}…</p>
        )}

        {tab === "guests" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="Search name / email / phone"
                  className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">All tags</option>
                  {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="last_stay">Last stay</option>
                  <option value="spent">Total spent</option>
                  <option value="bookings">Bookings</option>
                  <option value="name">Name</option>
                </select>
                <button onClick={() => load()} className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest">Search</button>
              </div>
              <p className="mt-2 text-[11px] text-stone">{loading ? "Loading…" : `${count} guest(s)`}</p>
              <div className="mt-3 max-h-[65vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-stone">
                    <tr>
                      <th className="p-2">Guest</th>
                      <th className="p-2 text-right">Bookings</th>
                      <th className="p-2 text-right">Nights</th>
                      <th className="p-2 text-right">Spent</th>
                      <th className="p-2">Last stay</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <React.Fragment key={r.id}>
                      <tr
                        className={`border-t border-border/40 hover:bg-coconut/40 ${selectedId === r.id ? "bg-coconut/60" : ""}`}>
                        <td className="p-2">
                          <div className="font-medium">{r.full_name ?? "—"}</div>
                          <div className="text-[11px] text-stone">{r.email}</div>
                          {r.tags?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.tags.map((t) => <span key={t} className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest">{t}</span>)}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 text-right">{r.total_bookings}</td>
                        <td className="p-2 text-right">{r.total_nights}</td>
                        <td className="p-2 text-right">RM {Number(r.total_spent).toFixed(0)}</td>
                        <td className="p-2 text-xs">{r.last_stay_at ?? "—"}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                            className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest hover:bg-coconut/60"
                          >
                            {selectedId === r.id ? "Close" : "Edit info"}
                          </button>
                          <button
                            onClick={() => setBookingsFor(bookingsFor === r.id ? null : r.id)}
                            className="ml-1 rounded-full bg-forest px-3 py-1 text-[10px] uppercase tracking-widest text-coconut hover:opacity-90"
                          >
                            {bookingsFor === r.id ? "Hide" : "Booking"}
                          </button>
                        </td>
                      </tr>
                      {selectedId === r.id && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="border-t border-border/40 bg-coconut/20 p-4">
                              <GuestDetail id={r.id} onChange={load} />
                            </div>
                          </td>
                        </tr>
                      )}
                      {bookingsFor === r.id && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="border-t border-border/40 bg-coconut/20 p-4">
                              <GuestBookingsPanel id={r.id} onChange={load} />
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                    {rows.length === 0 && !loading && (
                      <tr><td colSpan={6} className="p-4 text-center text-stone">
                        No guests yet — click "Sync from bookings" to build the directory.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function GuestDetail({ id, onChange }: { id: string | null; onChange: () => void }) {
  const [data, setData] = useState<any>(null);
  const [cabins, setCabins] = useState<{ id: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    getGuest({ data: { id } }).then((r) => {
      setData(r);
      setNotes(r.guest.notes ?? "");
      setName(r.guest.full_name ?? "");
      setEmail(r.guest.email ?? "");
      setPhone(r.guest.phone ?? "");
    });
    listCabins().then((c) => setCabins(c.cabins as any));
  }, [id]);

  if (!id) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-coconut/30 p-6 text-sm text-stone">
        Select a guest to see bookings, tags, notes and tasks.
      </div>
    );
  }
  if (!data) return <div className="rounded-xl border border-border bg-card p-4 text-sm">Loading…</div>;
  const g = data.guest as Guest;
  const isManualEmail = /^manual\+.*@admin\.local$/i.test(g.email ?? "");

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const patch: any = { id: g.id };
      if (name !== (g.full_name ?? "")) patch.full_name = name;
      if (phone !== (g.phone ?? "")) patch.phone = phone;
      if (!isManualEmail && email && email !== g.email) patch.email = email;
      await updateGuest({ data: patch });
      const r = await getGuest({ data: { id: g.id } }); setData(r); onChange();
    } catch (e: any) { alert(e?.message ?? "Failed"); }
    setSavingProfile(false);
  }

  async function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const next = Array.from(new Set([...(g.tags ?? []), t]));
    await updateGuest({ data: { id: g.id, tags: next } });
    setTagInput("");
    const r = await getGuest({ data: { id: g.id } }); setData(r); onChange();
  }
  async function removeTag(t: string) {
    const next = (g.tags ?? []).filter((x) => x !== t);
    await updateGuest({ data: { id: g.id, tags: next } });
    const r = await getGuest({ data: { id: g.id } }); setData(r); onChange();
  }
  async function saveNotes() {
    await updateGuest({ data: { id: g.id, notes } });
    onChange();
  }
  async function toggleOptIn() {
    await updateGuest({ data: { id: g.id, marketing_opt_in: !g.marketing_opt_in } });
    const r = await getGuest({ data: { id: g.id } }); setData(r); onChange();
  }
  async function addTask() {
    if (!taskTitle.trim()) return;
    await createTask({ data: { guest_id: g.id, title: taskTitle.trim(), due_at: taskDue || null } });
    setTaskTitle(""); setTaskDue("");
    const r = await getGuest({ data: { id: g.id } }); setData(r);
  }
  async function toggle(taskId: string, done: boolean) {
    await toggleTask({ data: { id: taskId, done } });
    const r = await getGuest({ data: { id: g.id } }); setData(r);
  }
  async function delTask(taskId: string) {
    await deleteTask({ data: { id: taskId } });
    const r = await getGuest({ data: { id: g.id } }); setData(r);
  }

  return (
    <aside className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg text-forest">{g.full_name ?? g.email}</h2>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={g.marketing_opt_in} onChange={toggleOptIn} /> Opt-in
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-[10px] uppercase tracking-widest text-stone">Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm normal-case" />
        </label>
        <label className="text-[10px] uppercase tracking-widest text-stone">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isManualEmail}
            className="mt-0.5 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm normal-case disabled:opacity-60" />
          {isManualEmail && <span className="mt-0.5 block text-[10px] normal-case text-stone">Manual entry — email locked</span>}
        </label>
        <label className="text-[10px] uppercase tracking-widest text-stone">Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-0.5 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm normal-case" />
        </label>
      </div>
      <button disabled={savingProfile} onClick={saveProfile} className="mt-2 rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest disabled:opacity-60">
        {savingProfile ? "Saving…" : "Save contact"}
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-coconut/50 p-2"><div className="text-lg font-medium">{g.total_bookings}</div>Bookings</div>
        <div className="rounded-lg bg-coconut/50 p-2"><div className="text-lg font-medium">{g.total_nights}</div>Nights</div>
        <div className="rounded-lg bg-coconut/50 p-2"><div className="text-lg font-medium">RM{Number(g.total_spent).toFixed(0)}</div>Spent</div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-stone">Tags</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(g.tags ?? []).map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] text-forest">
              {t}<button onClick={() => removeTag(t)} className="text-forest/70">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag (e.g. VIP, family)"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <button onClick={addTag} className="rounded-full bg-forest px-3 py-1 text-[10px] uppercase tracking-widest text-coconut">Add</button>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-stone">Notes</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm" />
        <button onClick={saveNotes} className="mt-1 rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-widest">Save notes</button>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-stone">Bookings</div>
        <div className="mt-1 max-h-56 overflow-auto text-xs">
          {(data.bookings as any[]).length === 0 && <div className="text-stone">No bookings.</div>}
          {(data.bookings as any[]).map((b) => (
            <BookingRow key={b.id} b={b} cabins={cabins} onSaved={async () => {
              const r = await getGuest({ data: { id: g.id } }); setData(r);
            }} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-stone">Follow-up tasks</div>
        <div className="mt-1 space-y-1 text-sm">
          {(data.tasks as any[]).map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
              <div className="flex-1">
                <div className={t.done ? "line-through text-stone" : ""}>{t.title}</div>
                {t.due_at && <div className="text-[10px] text-stone">Due {new Date(t.due_at).toLocaleString()}</div>}
              </div>
              <button onClick={() => delTask(t.id)} className="text-[10px] text-red-700 underline">delete</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="New task"
            className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <button onClick={addTask} className="rounded-full bg-forest px-3 py-1 text-[10px] uppercase tracking-widest text-coconut">Add</button>
        </div>
      </div>
    </aside>
  );
}

function BookingRow({ b, cabins, onSaved }: { b: any; cabins: { id: string; name: string }[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [ci, setCi] = useState(b.check_in);
  const [co, setCo] = useState(b.check_out);
  const [cabin, setCabin] = useState(b.cabin_id);
  const [rooms, setRooms] = useState(b.num_rooms ?? 1);
  const [guests, setGuests] = useState(b.guests ?? 1);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await editBooking({ data: { id: b.id, check_in: ci, check_out: co, cabin_id: cabin, num_rooms: Number(rooms), guests: Number(guests) } });
      setOpen(false);
      onSaved();
    } catch (e: any) { alert(e?.message ?? "Failed"); }
    setSaving(false);
  }
  return (
    <div className="border-t border-border/40 py-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div>{b.payment_reference ?? b.id.slice(0, 8)} · <span className="text-stone">{b.status}</span></div>
          <div className="text-[11px] text-stone">{b.check_in} → {b.check_out} · {b.nights}n · {b.num_rooms ?? 1} rm · RM{Number(b.total_amount ?? 0).toFixed(0)}</div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-forest underline">{open ? "close" : "edit"}</button>
      </div>
      {open && (
        <div className="mt-1 grid grid-cols-2 gap-2 rounded-md bg-coconut/40 p-2">
          <label className="text-[10px] uppercase tracking-widest text-stone">Check-in
            <input type="date" value={ci} onChange={(e) => setCi(e.target.value)} className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm normal-case" />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-stone">Check-out
            <input type="date" value={co} onChange={(e) => setCo(e.target.value)} className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm normal-case" />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-stone col-span-2">Cabin
            <select value={cabin ?? ""} onChange={(e) => setCabin(e.target.value)} className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm normal-case">
              {cabins.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-widest text-stone">Rooms
            <input type="number" min={1} max={8} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm" />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-stone">Guests
            <input type="number" min={1} max={30} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm" />
          </label>
          <button disabled={saving} onClick={save} className="col-span-2 rounded-full bg-forest px-3 py-1 text-[10px] uppercase tracking-widest text-coconut disabled:opacity-60">
            {saving ? "Saving…" : "Save booking"}
          </button>
        </div>
      )}
    </div>
  );
}

function ByDatePanel({ onOpenGuest }: { onOpenGuest: (email: string, name?: string | null) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const { from, to } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0); // last day of month
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { from: fmt(start), to: fmt(end) };
  }, [month]);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [cabins, setCabins] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { listCabins().then((c) => setCabins(c.cabins as any)); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await listBookingsByDate({ data: { from, to, search: search || undefined } });
      setRows(r.rows);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  // Collapse multi-room bookings into 1 row per guest (per booking_group_id),
  // then group by check-in date.
  const groups = useMemo(() => {
    // Aggregate rows sharing a booking_group_id
    const byGroup = new Map<string, any[]>();
    for (const r of rows) {
      const key = r.booking_group_id ?? r.id;
      const arr = byGroup.get(key) ?? [];
      arr.push(r);
      byGroup.set(key, arr);
    }
    const merged: any[] = [];
    for (const arr of byGroup.values()) {
      const b = arr[0];
      const cabinNames = Array.from(
        new Set(
          arr
            .map((r) => r.cabins?.name ?? r.room_type ?? "")
            .filter(Boolean),
        ),
      );
      // Group by cabin type prefix, combine trailing room numbers:
      // ["Twin room 4","Twin room 2","Queen room 1"] -> "Twin room 2, 4; Queen room 1"
      const byType = new Map<string, number[]>();
      const bare: string[] = [];
      for (const name of cabinNames) {
        const m = /^(.*?)\s*(\d+)\s*$/.exec(name);
        if (m) {
          const prefix = m[1].trim();
          const num = Number(m[2]);
          const list = byType.get(prefix) ?? [];
          list.push(num);
          byType.set(prefix, list);
        } else {
          bare.push(name);
        }
      }
      const groupedLabel = [
        ...Array.from(byType.entries()).map(
          ([prefix, nums]) =>
            `${prefix} ${Array.from(new Set(nums)).sort((a, b) => a - b).join(", ")}`,
        ),
        ...bare,
      ].join("; ");
      merged.push({
        ...b,
        _cabin_label: groupedLabel || "—",
        num_rooms: arr.reduce((s, r) => s + Number(r.num_rooms ?? 1), 0),
        total_amount: arr.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
      });
    }
    const m = new Map<string, any[]>();
    for (const r of merged) {
      const d = r.check_in ?? "—";
      const a = m.get(d) ?? [];
      a.push(r);
      m.set(d, a);
    }
    for (const [, a] of m) a.sort((x, y) => String(x.payment_reference ?? x.id).localeCompare(String(y.payment_reference ?? y.id)));
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] uppercase tracking-widest text-stone">Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-0.5 block h-9 rounded border border-border bg-background px-2 py-1 text-sm normal-case" />
        </label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search name / phone / booking #"
          className="flex-1 min-w-[200px] h-9 rounded-md border border-border bg-background px-3 text-sm" />
        <button onClick={load} className="h-9 rounded-full bg-forest px-4 text-xs uppercase tracking-widest text-coconut">
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-stone">{rows.length} booking(s) with check-in between {from} and {to}.</p>

      <div className="mt-4 space-y-6">
        {groups.length === 0 && !loading && (
          <div className="rounded border border-dashed border-border p-6 text-center text-sm text-stone">No bookings in this range.</div>
        )}
        {groups.map(([date, list]) => {
          const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
          const totalPax = list.reduce((s, b) => s + Number(b.guests ?? 0), 0);
          const totalRooms = list.reduce((s, b) => s + Number(b.num_rooms ?? 1), 0);
          return (
            <div key={date}>
              <div className="sticky top-0 z-10 flex items-baseline justify-between border-b-2 border-forest/30 bg-card py-1">
                <h3 className="font-display text-base text-forest">{dateLabel}</h3>
                <span className="text-[11px] text-stone">{list.length} booking(s) · {totalRooms} room(s) · {totalPax} pax</span>
              </div>
              <div className="overflow-x-auto">
                <table className="mt-1 w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-stone">
                    <tr>
                      <th className="p-2">Booking #</th>
                      <th className="p-2">Guest</th>
                      <th className="p-2">Contact</th>
                      <th className="p-2">Cabin / Room</th>
                      <th className="p-2 text-right">Rooms</th>
                      <th className="p-2 text-right">Pax</th>
                      <th className="p-2">Check-out</th>
                      <th className="p-2 text-right">Nights</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setEditing(b)}
                        className="cursor-pointer border-t border-border/40 align-top hover:bg-coconut/40"
                      >
                        <td className="p-2 font-mono text-xs">{b.payment_reference ?? b.id.slice(0, 8)}</td>
                        <td className="p-2">
                          {b.email ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onOpenGuest(b.email, b.guest_name); }}
                              className="text-forest underline underline-offset-2 hover:opacity-80"
                              title="Open in CRM"
                            >
                              {b.guest_name ?? b.email}
                            </button>
                          ) : (
                            b.guest_name ?? "—"
                          )}
                        </td>
                        <td className="p-2 text-xs text-stone">
                          {b.phone ?? ""}<br />{b.email ?? ""}
                        </td>
                        <td className="p-2">{b._cabin_label ?? b.cabins?.name ?? b.room_type ?? "—"}</td>
                        <td className="p-2 text-right">{b.num_rooms ?? 1}</td>
                        <td className="p-2 text-right">{b.guests ?? "—"}</td>
                        <td className="p-2 text-xs">{b.check_out ?? "—"}</td>
                        <td className="p-2 text-right">{b.nights ?? "—"}</td>
                        <td className="p-2 text-right">RM{Number(b.total_amount ?? 0).toFixed(0)}</td>
                        <td className="p-2 text-xs">{b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <BookingEditModal
          booking={editing}
          cabins={cabins}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function BookingEditModal({
  booking, cabins, onClose, onSaved,
}: { booking: any; cabins: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    guest_name: booking.guest_name ?? "",
    email: booking.email ?? "",
    phone: booking.phone ?? "",
    status: booking.status ?? "confirmed",
    check_in: booking.check_in ?? "",
    check_out: booking.check_out ?? "",
    cabin_id: booking.cabin_id ?? "",
    num_rooms: Number(booking.num_rooms ?? 1),
    guests: Number(booking.guests ?? 1),
    total_amount: Number(booking.total_amount ?? 0),
    notes: booking.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }
  async function save() {
    setSaving(true); setErr(null);
    try {
      await editBooking({ data: {
        id: booking.id,
        guest_name: f.guest_name || undefined,
        email: f.email || undefined,
        phone: f.phone || undefined,
        status: f.status as any,
        check_in: f.check_in || undefined,
        check_out: f.check_out || undefined,
        cabin_id: f.cabin_id || undefined,
        num_rooms: Number(f.num_rooms),
        guests: Number(f.guests),
        total_amount: Number(f.total_amount),
        notes: f.notes ?? null,
      } });
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    }
    setSaving(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg text-forest">Edit booking</h3>
            <p className="text-xs text-stone">{booking.payment_reference ?? booking.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="text-stone hover:text-forest">✕</button>
        </div>
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <L label="Guest name"><input value={f.guest_name} onChange={(e) => set("guest_name", e.target.value)} className={inp} /></L>
          <L label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} /></L>
          <L label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} className={inp} /></L>
          <L label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className={inp}>
              {["pending_payment","awaiting_review","confirmed","fully_paid","cancelled","expired"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </L>
          <L label="Check-in"><input type="date" value={f.check_in} onChange={(e) => set("check_in", e.target.value)} className={inp} /></L>
          <L label="Check-out"><input type="date" value={f.check_out} onChange={(e) => set("check_out", e.target.value)} className={inp} /></L>
          <L label="Cabin / Room">
            <select value={f.cabin_id ?? ""} onChange={(e) => set("cabin_id", e.target.value)} className={inp}>
              <option value="">—</option>
              {cabins.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </L>
          <L label="Rooms"><input type="number" min={1} max={8} value={f.num_rooms} onChange={(e) => set("num_rooms", Number(e.target.value))} className={inp} /></L>
          <L label="Guests (pax)"><input type="number" min={1} max={30} value={f.guests} onChange={(e) => set("guests", Number(e.target.value))} className={inp} /></L>
          <L label="Total amount (RM)"><input type="number" min={0} step="0.01" value={f.total_amount} onChange={(e) => set("total_amount", Number(e.target.value))} className={inp} /></L>
          <L label="Notes" full>
            <textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} className={inp} />
          </L>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-widest">Cancel</button>
          <button disabled={saving} onClick={save} className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = "mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm";
function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`text-[10px] uppercase tracking-widest text-stone ${full ? "col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function GuestBookingsPanel({ id, onChange }: { id: string; onChange: () => void }) {
  const [data, setData] = useState<any>(null);
  const [cabins, setCabins] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  async function reload() {
    const r = await getGuest({ data: { id } });
    setData(r);
  }
  useEffect(() => {
    reload();
    listCabins().then((c) => setCabins(c.cabins as any));
  }, [id]);
  if (!data) return <div className="text-sm text-stone">Loading…</div>;
  const bookings = (data.bookings ?? []) as any[];
  if (bookings.length === 0) return <div className="text-sm text-stone">No bookings yet.</div>;
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-stone">Bookings — click a row for full details</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-stone">
            <tr>
              <th className="p-2">Booking #</th>
              <th className="p-2">Check-in</th>
              <th className="p-2">Check-out</th>
              <th className="p-2 text-right">Nights</th>
              <th className="p-2 text-right">Rooms</th>
              <th className="p-2 text-right">Pax</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr
                key={b.id}
                className="cursor-pointer border-t border-border/40 hover:bg-coconut/40"
              >
                <td className="p-2 font-mono text-xs">
                  <Link
                    to="/admin"
                    hash={`b-${b.id}`}
                    className="text-forest underline underline-offset-2 hover:opacity-80"
                    title="Open full booking in Bookings tab"
                  >
                    {b.payment_reference ?? b.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="p-2 text-xs">{b.check_in ?? "—"}</td>
                <td className="p-2 text-xs">{b.check_out ?? "—"}</td>
                <td className="p-2 text-right">{b.nights ?? "—"}</td>
                <td className="p-2 text-right">{b.num_rooms ?? 1}</td>
                <td className="p-2 text-right">{b.guests ?? "—"}</td>
                <td className="p-2 text-right">RM{Number(b.total_amount ?? 0).toFixed(0)}</td>
                <td className="p-2 text-xs">{b.status}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => setEditing(b)}
                    className="text-[10px] text-stone underline"
                  >
                    quick edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <BookingEditModal
          booking={editing}
          cabins={cabins}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reload(); onChange(); }}
        />
      )}
    </div>
  );
}
