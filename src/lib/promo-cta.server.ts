export const PROMO_CTA_KEY = "hero_promo_cta";

export type PromoCtaItem = {
  id: string;
  enabled: boolean;
  text_en: string;
  text_bm: string;
};

export type HeroPromoCta = { items: PromoCtaItem[] };

export const DEFAULT_PROMO_ITEM: PromoCtaItem = {
  id: "default",
  enabled: true,
  text_en: "Stay longer, save more — 10% off from your 2nd night onwards. Auto-applied.",
  text_bm:
    "Menginap lebih lama, jimat lebih banyak — Diskaun 10% mulai malam ke-2 dan seterusnya. Dikenakan secara automatik.",
};

export function makePromoId() {
  return `cta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizePromoCta(value: any): HeroPromoCta {
  if (!value || typeof value !== "object") return { items: [DEFAULT_PROMO_ITEM] };
  if (Array.isArray(value.items) === false && (value.text_en || value.text_bm)) {
    return {
      items: [
        {
          id: "default",
          enabled: typeof value.enabled === "boolean" ? value.enabled : true,
          text_en:
            typeof value.text_en === "string" && value.text_en.trim()
              ? value.text_en
              : DEFAULT_PROMO_ITEM.text_en,
          text_bm:
            typeof value.text_bm === "string" && value.text_bm.trim()
              ? value.text_bm
              : DEFAULT_PROMO_ITEM.text_bm,
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
  if (cleaned.length === 0) return { items: [DEFAULT_PROMO_ITEM] };
  return { items: cleaned };
}