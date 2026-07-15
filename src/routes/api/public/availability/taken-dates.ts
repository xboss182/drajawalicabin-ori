import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  cabinId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.floor((end - start) / 86_400_000);
}

export const Route = createFileRoute("/api/public/availability/taken-dates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          cabinId: url.searchParams.get("cabinId"),
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
        });

        if (!parsed.success) {
          return Response.json({ dates: [] }, { status: 400 });
        }

        const { cabinId, from, to } = parsed.data;
        const span = daysBetween(from, to);
        if (span < 0 || span > 180) {
          return Response.json({ dates: [] }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("cabin_taken_dates", {
          _cabin_id: cabinId,
          _from: from,
          _to: to,
        });

        if (error) {
          console.error("[taken-dates api] rpc failed", error.message);
          return Response.json({ dates: [] }, { status: 200 });
        }

        const dates = ((data ?? []) as Array<{ d?: string }>)
          .map((row) => row.d)
          .filter((date): date is string => typeof date === "string");

        return Response.json({ dates }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});