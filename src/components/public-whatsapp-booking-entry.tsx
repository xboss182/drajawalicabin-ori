import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import { getWhatsappBookingEntry } from "@/lib/wa-admin.functions";
import { whatsappBookingHref } from "@/lib/whatsapp-ui";

export function PublicWhatsAppBookingEntry({ title = "Book in WhatsApp" }: { title?: string }) {
  const href = useWhatsappBookingHref();

  return (
    <main
      id="top"
      className="grid min-h-[100svh] place-items-center bg-coconut px-6 py-12 text-foreground"
    >
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Rajawali D&apos;Cabin</p>
        <h1 className="mt-3 text-balance font-display text-4xl text-forest">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground/75">
          Choose dates, guests, cabin, add-ons and payment steps privately in our WhatsApp chat. No
          booking selections are collected on this website.
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-medium text-coconut transition hover:bg-forest/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Book in WhatsApp
          </a>
        ) : (
          <p role="status" className="mt-7 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            WhatsApp booking is being prepared. Please contact the cabin directly for help.
          </p>
        )}
        <Link
          to="/"
          className="mt-6 block text-xs uppercase tracking-widest text-forest underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}

function useWhatsappBookingHref() {
  const { data } = useQuery({
    queryKey: ["whatsapp-booking-entry"],
    queryFn: () => getWhatsappBookingEntry(),
    staleTime: 60_000,
  });

  return data?.enabled ? whatsappBookingHref(data.phone) : null;
}

export function BookInWhatsAppLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const href = useWhatsappBookingHref();
  const linkClassName = `${className ?? ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`;

  if (!href) {
    return (
      <Link to="/book" className={linkClassName}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={linkClassName}>
      {children}
    </a>
  );
}
