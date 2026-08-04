import { createFileRoute } from "@tanstack/react-router";

export const DEFAULT_STORE_WHATSAPP = "60103328747";

export const Route = createFileRoute("/api/public/store/config")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "whatsapp_store")
          .maybeSingle();
        const raw = (data?.value ?? {}) as Record<string, unknown>;
        const phone =
          typeof raw.phone === "string" && raw.phone.replace(/\D/g, "").length >= 8
            ? raw.phone.replace(/\D/g, "")
            : DEFAULT_STORE_WHATSAPP;
        const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;
        return Response.json({ phone, enabled }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
