import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "official-notice-dismissed";

export function OfficialNoticeBanner({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDismissed(raw === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="banner"
      className={cn(
        "relative border-b border-forest/10 bg-sand text-foreground",
        className,
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-forest" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-6 py-4 lg:px-10">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-forest sm:text-base">
              {t.notice.title}
            </p>
            <div className="mt-1.5 max-w-4xl text-xs leading-relaxed text-foreground/90 sm:text-sm">
              <p>{t.notice.line1}</p>
              <p className="mt-1.5">{t.notice.line2}</p>
              <p className="mt-1.5">{t.notice.line3}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(STORAGE_KEY, "true");
              } catch {}
            }}
            className="shrink-0 rounded-md p-1 text-forest/70 transition hover:bg-forest/10 hover:text-forest"
            aria-label={t.notice.close}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
