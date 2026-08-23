import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/store/config")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "whatsapp_booking")
          .maybeSingle();
        const raw = (data?.value ?? {}) as Record<string, unknown>;
        const configuredPhone = typeof raw.phone === "string" ? raw.phone.replace(/\D/g, "") : "";
        const enabled =
          raw.enabled === true && configuredPhone.length >= 8 && configuredPhone.length <= 15;
        const phone = enabled ? configuredPhone : null;
        return Response.json({ phone, enabled }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
