import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "promo-2nd-night-dismissed-v1";

export function PromoAnnouncementBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="relative z-40 bg-forest text-coconut">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-2 text-center text-[11px] sm:text-xs">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-sand" aria-hidden />
        <span>
          Stay 2+ nights — enjoy{" "}
          <strong className="font-semibold text-sand">10% off from the 2nd night onwards</strong>.
          Auto-applied at checkout.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-coconut/70 transition hover:bg-coconut/10 hover:text-coconut"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}