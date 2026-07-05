import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 10000;

/**
 * Slim top-of-page banner. Auto-dismisses after ~10s, or when the user
 * clicks the close button. Shows once per page load (no persistence).
 */
export function OfficialNoticeBanner({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setVisible(false), 400);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-50 w-full border-b border-forest/20 bg-forest text-coconut transition-all duration-300",
        leaving ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:items-center sm:px-6 lg:px-10">
        <p className="flex-1 text-xs leading-snug text-coconut/95 sm:text-sm">
          {t.noticeShort}
        </p>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="shrink-0 rounded-md p-1 text-coconut/80 transition hover:bg-coconut/10 hover:text-coconut"
          aria-label={t.notice.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Permanent, non-dismissible notice designed to sit above the site footer
 * on every page.
 */
export function OfficialNoticeFooter({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="note"
      className={cn(
        "w-full border-t border-forest/15 bg-sand/70 text-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-6 py-4 lg:px-10">
        <p className="text-xs leading-relaxed text-foreground/80 sm:text-sm">
          {t.noticeShort}
        </p>
      </div>
    </div>
  );
}
