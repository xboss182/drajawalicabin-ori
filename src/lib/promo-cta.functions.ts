import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY = "hero_promo_cta";

const DEFAULT_ITEM = {
  id: "default",
  enabled: true,
  text_en: "Stay longer, save more — 10% off from your 2nd night onwards. Auto-applied.",
  text_bm:
    "Menginap lebih lama, jimat lebih banyak — Diskaun 10% mulai malam ke-2 dan seterusnya. Dikenakan secara automatik.",
};

export type PromoCtaItem = {
  id: string;
  enabled: boolean;
  text_en: string;
  text_bm: string;
};

export type HeroPromoCta = { items: PromoCtaItem[] };

function makeId() {
  return `cta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalize(value: any): HeroPromoCta {
  if (!value || typeof value !== "object") return { items: [DEFAULT_ITEM] };
  // Legacy shape: { enabled, text_en, text_bm }
  if (Array.isArray(value.items) === false && (value.text_en || value.text_bm)) {
    return {
      items: [
        {
          id: "default",
          enabled: typeof value.enabled === "boolean" ? value.enabled : true,
          text_en:
            typeof value.text_en === "string" && value.text_en.trim()
              ? value.text_en
              : DEFAULT_ITEM.text_en,
          text_bm:
            typeof value.text_bm === "string" && value.text_bm.trim()
              ? value.text_bm
              : DEFAULT_ITEM.text_bm,
        },
      ],
    };
  }
  const items = Array.isArray(value.items) ? value.items : [];
  const cleaned: PromoCtaItem[] = items
    .map((it: any, i: number): PromoCtaItem | null => {
      if (!it || typeof it !== "object") return null;
      const text_en = typeof it.text_en === "string" ? it.text_en.trim() : "";
      const text_bm = typeof it.text_bm === "string" ? it.text_bm.trim() : "";
      if (!text_en || !text_bm) return null;
      return {
        id: typeof it.id === "string" && it.id ? it.id : `item_${i}`,
        enabled: typeof it.enabled === "boolean" ? it.enabled : false,
        text_en: text_en.slice(0, 240),
        text_bm: text_bm.slice(0, 240),
      };
    })
    .filter((x: PromoCtaItem | null): x is PromoCtaItem => x !== null);
  if (cleaned.length === 0) return { items: [DEFAULT_ITEM] };
  return { items: cleaned };
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getHeroPromoCta = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    if (error) return { items: [DEFAULT_ITEM] };
    return normalize(data?.value);
  } catch {
    return { items: [DEFAULT_ITEM] };
  }
});

const ItemSchema = z.object({
  id: z.string().min(1).max(64),
  enabled: z.boolean(),
  text_en: z.string().trim().min(3).max(240),
  text_bm: z.string().trim().min(3).max(240),
});

export const updateHeroPromoCta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ items: z.array(ItemSchema).max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: KEY, value: data as any, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generatePromoCtaAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ hint: z.string().trim().max(300).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const hint = data.hint?.trim() ? `Extra guidance from the admin: ${data.hint.trim()}` : "";

    const system = `You write short, catchy promo lines for a Malaysian riverside chalet called Rajawali D'Cabin.
The promo: guests get an automatic 10% discount from their 2nd night onwards when they book directly on the website.
Write ONE catchy sentence in English and ONE in Bahasa Malaysia. Each under 120 characters. Warm, friendly, no emojis, no quotes.
Return STRICT JSON with exactly these keys: {"text_en": string, "text_bm": string}. No markdown, no commentary.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: hint || "Generate a fresh line now." },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content ?? "";
    let parsed: { text_en?: string; text_bm?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }
    const text_en = String(parsed.text_en ?? "").trim();
    const text_bm = String(parsed.text_bm ?? "").trim();
    if (!text_en || !text_bm) throw new Error("AI response missing text fields");
    return {
      id: makeId(),
      enabled: true,
      text_en: text_en.slice(0, 240),
      text_bm: text_bm.slice(0, 240),
    } satisfies PromoCtaItem;
  });
