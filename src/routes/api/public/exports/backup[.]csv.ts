// Full data backup — downloads all key business tables as a single CSV file,
// one section per table. Token-protected like the existing bookings CSV export.
// URL: /api/public/exports/backup.csv?token=<BOOKINGS_EXPORT_TOKEN>
import { createFileRoute } from "@tanstack/react-router";

type Row = Record<string, unknown>;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(headers: string[], row: Row): string {
  return headers.map((h) => csvEscape(row[h])).join(",");
}

/** Extract stable, serializable headers from a row (skips nested objects/arrays). */
function headersFor(rows: Row[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (seen.has(k)) continue;
      const v = r[k];
      if (v !== null && typeof v === "object") continue; // skip nested cabins() etc.
      seen.add(k);
      ordered.push(k);
    }
  }
  return ordered;
}

export const Route = createFileRoute("/api/public/exports/backup.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.BOOKINGS_EXPORT_TOKEN;
        const url = new URL(request.url);
        const presented = url.searchParams.get("token") ?? "";
        if (!expected || !presented || presented !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const tables: Array<{ name: string; select: string }> = [
          { name: "booking_requests", select: "*" },
          { name: "cabins", select: "*" },
          { name: "crm_guests", select: "*" },
          { name: "crm_tasks", select: "*" },
          { name: "discounts", select: "*" },
          { name: "discount_redemptions", select: "*" },
          { name: "school_holidays", select: "*" },
          { name: "admin_email_recipients", select: "*" },
          { name: "user_roles", select: "*" },
          { name: "app_settings", select: "*" },
        ];

        const sections: string[] = [];
        for (const t of tables) {
          const { data, error } = await supabaseAdmin.from(t.name).select(t.select);
          if (error) {
            sections.push(`# ${t.name}\n# ERROR: ${error.message}\n`);
            continue;
          }
          const rows = (data ?? []) as unknown as Row[];
          const headers = headersFor(rows);
          const lines: string[] = [`# TABLE: ${t.name} (${rows.length} rows)`];
          if (headers.length && rows.length) {
            lines.push(headers.join(","));
            for (const r of rows) lines.push(rowToCsv(headers, r));
          } else {
            lines.push("# (no rows)");
          }
          sections.push(lines.join("\n"));
        }

        const stamp = new Date().toISOString().slice(0, 10);
        const body = "\uFEFF" + sections.join("\n\n") + "\n";
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="rajawali-backup-${stamp}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
