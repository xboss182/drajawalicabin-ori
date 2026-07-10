import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "official-notice-dismissed-v1";

export function OfficialNoticeToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }

    const markDismissed = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    };

    const id = window.setTimeout(() => {
      toast("Official website", {
        description:
          "This is the only official site for Rajawali D'Cabin. We're not affiliated with OYO, Agoda, Booking.com or Expedia. Please book directly here.",
        duration: 12000,
        action: {
          label: "Got it",
          onClick: markDismissed,
        },
        onDismiss: markDismissed,
        onAutoClose: markDismissed,
      });
    }, 800);

    return () => window.clearTimeout(id);
  }, []);

  return null;
}