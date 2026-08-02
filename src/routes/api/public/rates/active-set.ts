import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/rates/active-set")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "active_rate_set")
          .maybeSingle();
        const rateSet = (data?.value as unknown) === "legacy" ? "legacy" : "current";
        return Response.json({ rateSet }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});