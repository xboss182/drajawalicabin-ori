import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import pool01 from "@/assets/gallery/pool-01.jpg.asset.json";
import common01 from "@/assets/gallery/common-area-01.jpg.asset.json";
import common02 from "@/assets/gallery/common-area-02.jpg.asset.json";
import bbq01 from "@/assets/gallery/bbq-pavilion-01.jpg.asset.json";
import bbq02 from "@/assets/gallery/bbq-pavilion-02.jpg.asset.json";
import bbq03 from "@/assets/gallery/bbq-pavilion-03.jpg.asset.json";
import cabin01 from "@/assets/gallery/cabin-exterior-01.jpg.asset.json";
import cabin02 from "@/assets/gallery/cabin-exterior-02.jpg.asset.json";
import cabin03 from "@/assets/gallery/cabin-exterior-03.jpg.asset.json";
import cabin04 from "@/assets/gallery/cabin-exterior-04.jpg.asset.json";
import cabinInt01 from "@/assets/gallery/cabin-interior-01.jpg.asset.json";
import cabinInt02 from "@/assets/gallery/cabin-interior-02.jpg.asset.json";
import cabinInt03 from "@/assets/gallery/cabin-interior-03.jpg.asset.json";
import cabinInt04 from "@/assets/gallery/cabin-interior-04.jpg.asset.json";
import cabinInt05 from "@/assets/gallery/cabin-interior-05.jpg.asset.json";
import parking01 from "@/assets/gallery/parking-01.jpg.asset.json";
import parking02 from "@/assets/gallery/parking-02.jpg.asset.json";
import motoParking from "@/assets/gallery/motorcycle-parking-01.jpg.asset.json";
import landmark01 from "@/assets/gallery/landmark-01.jpg.asset.json";
import landmark02 from "@/assets/gallery/landmark-02.jpg.asset.json";
import guests01 from "@/assets/gallery/guests-01.jpg.asset.json";
import guests02 from "@/assets/gallery/guests-02.jpg.asset.json";
import guests03 from "@/assets/gallery/guests-03.jpg.asset.json";
import review01 from "@/assets/gallery/review-01.mp4.asset.json";

type Category = {
  id: string;
  label: string;
  description: string;
  photos: { url: string; alt: string }[];
};

type MediaItem =
  | { type: "photo"; url: string; alt: string; cat: string }
  | { type: "video"; url: string; alt: string; cat: string };

const VIDEOS: { url: string; alt: string }[] = [
  { url: review01.url, alt: "Guest video at Rajawali D'Cabin" },
];

const CATEGORIES: Category[] = [
  {
    id: "cabins",
    label: "Cabins",
    description: "Our private container-style cabins with landscaped surrounds.",
    photos: [
      { url: cabin01.url, alt: "Cabin exterior with tropical landscaping" },
      { url: cabin02.url, alt: "Row of blue cabins under clear sky" },
      { url: cabin03.url, alt: "Cabin walkway lined with heliconia plants" },
      { url: cabin04.url, alt: "Cabin garden path" },
      { url: cabinInt05.url, alt: "Covered cabin walkway and porch" },
      { url: cabinInt01.url, alt: "Queen bedroom interior with wall fan" },
      { url: cabinInt02.url, alt: "Twin beds inside a cabin" },
      { url: cabinInt03.url, alt: "Cabin room with queen bed and window" },
      { url: cabinInt04.url, alt: "Twin bed cabin interior" },
    ],
  },
  {
    id: "bbq",
    label: "BBQ & Common Area",
    description: "Sheltered picnic and BBQ pavilion for guests.",
    photos: [
      { url: bbq01.url, alt: "Covered picnic and BBQ pavilion" },
      { url: bbq02.url, alt: "Picnic benches under blue awning" },
      { url: bbq03.url, alt: "BBQ pit and seating area" },
      { url: common01.url, alt: "Covered walkway between cabins" },
      { url: common02.url, alt: "Landscaped common area with plants" },
    ],
  },
  {
    id: "pool",
    label: "Pool",
    description: "On-site splash pool for kids and guests.",
    photos: [{ url: pool01.url, alt: "Chalet splash pool" }],
  },
  {
    id: "parking",
    label: "Parking",
    description: "Ample on-site parking for cars and motorbikes.",
    photos: [
      { url: parking01.url, alt: "On-site car parking" },
      { url: parking02.url, alt: "Parking area with guest vehicles" },
      { url: motoParking.url, alt: "Motorcycle parking bay" },
    ],
  },
  {
    id: "nearby",
    label: "Nearby",
    description: "Landmarks a short drive from the chalet.",
    photos: [
      { url: landmark01.url, alt: "Traditional Terengganu landmark building" },
      { url: landmark02.url, alt: "Heritage building near Chendering" },
    ],
  },
  {
    id: "guests",
    label: "Guests & Events",
    description: "Groups and families who have stayed with us.",
    photos: [
      { url: guests01.url, alt: "Guest group photo at the chalet" },
      { url: guests02.url, alt: "Guests enjoying a meal together" },
      { url: guests03.url, alt: "Family gathering at the chalet" },
    ],
  },
];


export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Rajawali D'Cabin Chalet, Chendering" },
      {
        name: "description",
        content:
          "Photos and videos of Rajawali D'Cabin Chalet in Chendering, Kuala Terengganu — cabins, BBQ pavilion, pool, parking and nearby landmarks.",
      },
      { property: "og:title", content: "Gallery — Rajawali D'Cabin Chalet" },
      {
        property: "og:description",
        content:
          "See our cabins, BBQ area, pool, parking and surroundings in Chendering, Kuala Terengganu.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://drajawalicabin.com/gallery" },
      { property: "og:image", content: cabin01.url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: cabin01.url },
    ],
    links: [{ rel: "canonical", href: "https://drajawalicabin.com/gallery" }],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [active, setActive] = useState<string>("all");
  const [lightbox, setLightbox] = useState<
    { url: string; alt: string; type: "photo" | "video" } | null
  >(null);

  const visible: MediaItem[] = (() => {
    if (active === "all") {
      return [
        ...CATEGORIES.flatMap((c) =>
          c.photos.map((p) => ({ type: "photo" as const, ...p, cat: c.label }))
        ),
        ...VIDEOS.map((v) => ({ type: "video" as const, ...v, cat: "Videos" })),
      ];
    }
    if (active === "videos") {
      return VIDEOS.map((v) => ({ type: "video" as const, ...v, cat: "Videos" }));
    }
    return (
      CATEGORIES.find((c) => c.id === active)?.photos.map((p) => ({
        type: "photo" as const,
        ...p,
        cat: CATEGORIES.find((c) => c.id === active)!.label,
      })) ?? []
    );
  })();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-forest text-coconut">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-lg leading-tight">
            Rajawali D'Cabin
            <span className="block text-[10px] uppercase tracking-[0.25em] opacity-80">
              Chalet · Chendering
            </span>
          </Link>
          <Link
            to="/"
            className="text-xs uppercase tracking-widest text-coconut/90 hover:text-coconut"
          >
            ← Back
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Gallery</p>
        <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">
          A look inside Rajawali D'Cabin
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Photos of our cabins, BBQ pavilion, pool, parking and the surroundings in Chendering,
          Kuala Terengganu.
        </p>

        {/* Category chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip active={active === "all"} onClick={() => setActive("all")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>

        {/* Content */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p, i) => (
            <button
              key={`${p.url}-${i}`}
              type="button"
              onClick={() => setLightbox(p)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={p.url}
                alt={p.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-white opacity-0 transition-opacity group-hover:opacity-100">
                {p.cat}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
          >
            ✕
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition " +
        (active
          ? "border-forest bg-forest text-coconut"
          : "border-border bg-background text-foreground hover:bg-muted")
      }
    >
      {children}
    </button>
  );
}