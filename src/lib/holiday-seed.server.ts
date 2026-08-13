export type SeedRow = {
  label: string;
  starts_on: string;
  ends_on: string;
  kind: "public_holiday" | "school_break";
};

export const HOLIDAY_SEED_ROWS: SeedRow[] = [
  // ===== 2026 =====
  { label: "New Year's Day", starts_on: "2026-01-01", ends_on: "2026-01-01", kind: "public_holiday" },
  { label: "Chinese New Year", starts_on: "2026-02-17", ends_on: "2026-02-18", kind: "public_holiday" },
  { label: "Hari Raya Aidilfitri", starts_on: "2026-03-21", ends_on: "2026-03-22", kind: "public_holiday" },
  { label: "Labour Day", starts_on: "2026-05-01", ends_on: "2026-05-01", kind: "public_holiday" },
  { label: "Wesak Day", starts_on: "2026-05-31", ends_on: "2026-05-31", kind: "public_holiday" },
  { label: "Agong's Birthday", starts_on: "2026-06-01", ends_on: "2026-06-01", kind: "public_holiday" },
  { label: "Hari Raya Haji", starts_on: "2026-05-27", ends_on: "2026-05-27", kind: "public_holiday" },
  { label: "Awal Muharram", starts_on: "2026-06-17", ends_on: "2026-06-17", kind: "public_holiday" },
  { label: "Israk & Mikraj", starts_on: "2026-01-17", ends_on: "2026-01-17", kind: "public_holiday" },
  { label: "Awal Ramadan", starts_on: "2026-02-19", ends_on: "2026-02-19", kind: "public_holiday" },
  { label: "Nuzul Al-Quran", starts_on: "2026-03-07", ends_on: "2026-03-07", kind: "public_holiday" },
  { label: "Ulang Tahun Pertabalan Sultan Terengganu", starts_on: "2026-03-04", ends_on: "2026-03-04", kind: "public_holiday" },
  { label: "Sultan of Terengganu Birthday", starts_on: "2026-04-26", ends_on: "2026-04-26", kind: "public_holiday" },
  { label: "Hari Arafah", starts_on: "2026-05-26", ends_on: "2026-05-26", kind: "public_holiday" },
  { label: "Hari Raya Haji (Hari Kedua)", starts_on: "2026-05-28", ends_on: "2026-05-28", kind: "public_holiday" },
  { label: "Merdeka Day", starts_on: "2026-08-31", ends_on: "2026-08-31", kind: "public_holiday" },
  { label: "Maulidur Rasul", starts_on: "2026-08-25", ends_on: "2026-08-25", kind: "public_holiday" },
  { label: "Malaysia Day", starts_on: "2026-09-16", ends_on: "2026-09-16", kind: "public_holiday" },
  { label: "Deepavali", starts_on: "2026-11-08", ends_on: "2026-11-08", kind: "public_holiday" },
  { label: "Christmas Day", starts_on: "2026-12-25", ends_on: "2026-12-25", kind: "public_holiday" },
  // Official KPM Kalendar Akademik 2026 — Kumpulan A (Kedah, Kelantan, Terengganu)
  { label: "Cuti Penggal 1 (KPM Kumpulan A)", starts_on: "2026-03-20", ends_on: "2026-03-28", kind: "school_break" },
  { label: "Cuti Pertengahan Tahun (KPM Kumpulan A)", starts_on: "2026-05-22", ends_on: "2026-06-06", kind: "school_break" },
  { label: "Cuti Penggal 2 (KPM Kumpulan A)", starts_on: "2026-08-28", ends_on: "2026-09-05", kind: "school_break" },
  { label: "Cuti Akhir Persekolahan (KPM Kumpulan A)", starts_on: "2026-12-04", ends_on: "2026-12-31", kind: "school_break" },

  // ===== 2027 =====
  { label: "New Year's Day", starts_on: "2027-01-01", ends_on: "2027-01-01", kind: "public_holiday" },
  { label: "Chinese New Year", starts_on: "2027-02-06", ends_on: "2027-02-07", kind: "public_holiday" },
  { label: "Hari Raya Aidilfitri", starts_on: "2027-03-10", ends_on: "2027-03-11", kind: "public_holiday" },
  { label: "Labour Day", starts_on: "2027-05-01", ends_on: "2027-05-01", kind: "public_holiday" },
  { label: "Wesak Day", starts_on: "2027-05-20", ends_on: "2027-05-20", kind: "public_holiday" },
  { label: "Hari Raya Haji", starts_on: "2027-05-17", ends_on: "2027-05-17", kind: "public_holiday" },
  { label: "Agong's Birthday", starts_on: "2027-06-07", ends_on: "2027-06-07", kind: "public_holiday" },
  { label: "Awal Muharram", starts_on: "2027-06-06", ends_on: "2027-06-06", kind: "public_holiday" },
  { label: "Maulidur Rasul", starts_on: "2027-08-15", ends_on: "2027-08-15", kind: "public_holiday" },
  { label: "Merdeka Day", starts_on: "2027-08-31", ends_on: "2027-08-31", kind: "public_holiday" },
  { label: "Malaysia Day", starts_on: "2027-09-16", ends_on: "2027-09-16", kind: "public_holiday" },
  { label: "Deepavali", starts_on: "2027-10-28", ends_on: "2027-10-28", kind: "public_holiday" },
  { label: "Christmas Day", starts_on: "2027-12-25", ends_on: "2027-12-25", kind: "public_holiday" },
  // 2027 takwim not yet published — estimates, review before approving
  { label: "Cuti Penggal 1 (2027, estimate)", starts_on: "2027-03-13", ends_on: "2027-03-21", kind: "school_break" },
  { label: "Cuti Pertengahan Tahun (2027, estimate)", starts_on: "2027-05-29", ends_on: "2027-06-13", kind: "school_break" },
  { label: "Cuti Penggal 2 (2027, estimate)", starts_on: "2027-08-21", ends_on: "2027-08-29", kind: "school_break" },
  { label: "Cuti Akhir Persekolahan (2027, estimate)", starts_on: "2027-12-11", ends_on: "2028-01-02", kind: "school_break" },
];

export type PreviewRow = SeedRow & {
  status: "new" | "duplicate" | "overlap";
  note?: string;
};

const overlaps = (aS: string, aE: string, bS: string, bE: string) =>
  aS <= bE && bS <= aE;

/** Classify each candidate row against what is already in the database. */
export function buildHolidayPreview(
  existing: Array<{ label: string; starts_on: string; ends_on: string }>,
): PreviewRow[] {
  return HOLIDAY_SEED_ROWS.map((r) => {
    const dup = existing.find(
      (e) => e.label === r.label && e.starts_on === r.starts_on,
    );
    if (dup) return { ...r, status: "duplicate" as const, note: "Already in calendar" };
    const clash = existing.find((e) =>
      overlaps(r.starts_on, r.ends_on, e.starts_on, e.ends_on),
    );
    if (clash)
      return {
        ...r,
        status: "overlap" as const,
        note: `Overlaps "${clash.label}" (${clash.starts_on} → ${clash.ends_on})`,
      };
    return { ...r, status: "new" as const };
  });
}
