import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getBookingForGuest,
  attachBalanceProof,
  attachPaymentProof,
  getBookingByEmailAndReference,
} from "@/lib/booking.functions";
import duitnowQrAsset from "@/assets/duitnow-qr.png.asset.json";
import { isPaymentsConfigured } from "@/lib/stripe";
import { LanguageToggle, useLanguage } from "@/lib/i18n";
import { rememberBooking } from "@/lib/my-booking";

type Booking = Awaited<ReturnType<typeof getBookingForGuest>>;

export const Route = createFileRoute("/manage-booking")({
  validateSearch: (raw: Record<string, unknown>) => ({
    id: typeof raw.id === "string" ? raw.id : "",
    token: typeof raw.token === "string" ? raw.token : "",
  }),
  head: () => ({
    meta: [
      { title: "My booking — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "View your Rajawali D'Cabin reservation, upload your payment receipt, and manage your stay details online." },
      { property: "og:title", content: "My booking — Rajawali D'Cabin" },
      { property: "og:description", content: "View your reservation, upload your payment receipt, and manage your Rajawali D'Cabin stay." },
      { property: "og:url", content: "https://drajawalicabin.com/manage-booking" },
    ],
    links: [{ rel: "canonical", href: "https://drajawalicabin.com/manage-booking" }],
  }),
  component: ManagePage,
});

function useCopy() {
  const { lang } = useLanguage();
  const isBM = lang === "bm";
  return isBM
    ? {
        eyebrow: "Tempahan saya",
        lookupTitle: "Buka tempahan anda",
        lookupIntro: "Masukkan e-mel yang anda guna semasa menempah. Kami akan terus buka tempahan terkini anda.",
        email: "E-mel",
        pick: "Anda ada beberapa tempahan — pilih satu",
        open: "Buka tempahan saya",
        opening: "Membuka…",
        emailMeLink: "Hantar link ke e-mel saya",
        loading: "Sedang buka tempahan anda…",
        hi: "Hai",
        ref: "Nombor tempahan",
        nextStep: "Langkah seterusnya",
        needDeposit: "Muat naik resit deposit anda",
        needDepositBody: "Kami belum terima resit bayaran anda. Bayar guna QR / bank di bawah, kemudian muat naik resit di sini — tak perlu tempah semula.",
        needBalance: "Muat naik resit baki sewa bilik",
        needBalanceBody: "Bayar baki sewa bilik guna QR / bank di bawah, kemudian muat naik resit di sini.",
        reviewTitle: "Resit diterima — menunggu pengesahan",
        reviewBody: "Kami sedang semak bayaran anda. Salah muat naik? Anda boleh muat naik semula di bawah.",
        paidTitle: "Bayaran penuh ✓",
        paidBody: "Daftar masuk sendiri melalui locker kunci di kabin.",
        lockerSoon: "Kod locker akan dihantar melalui WhatsApp / e-mel pada hari daftar masuk.",
        lockerCode: "Kod locker",
        amountDue: "Jumlah perlu dibayar",
        payQr: "Bayar guna QR / pindahan bank",
        bank: "Pindahan bank",
        qr: "DuitNow QR",
        uploadTitle: "Muat naik resit",
        uploadHint: "Gambar skrin atau PDF resit anda.",
        chooseAgain: "Salah fail? Muat naik semula",
        submit: "Hantar resit",
        uploading: "Menghantar…",
        uploaded: "Terima kasih! Resit anda dah dihantar.",
        cardTitle: "Bayar dengan kad (paling cepat)",
        cardBody: "Bayaran kad akan sahkan tempahan anda serta-merta — tak perlu muat naik resit.",
        cardCta: "Bayar RM {amt} dengan kad →",
        or: "Atau — bayar manual (perlu pengesahan admin)",
        stay: "Butiran penginapan",
        cabin: "Kabin",
        checkIn: "Daftar masuk",
        checkOut: "Daftar keluar",
        guests: "Tetamu",
        roomRate: "Sewa bilik",
        depositPaid: "Deposit keselamatan",
        balanceDue: "Baki sewa bilik",
        policy: "Daftar keluar sebelum 12:00 tengah hari. Lewat dikenakan RM10 sejam (dibundarkan ke atas) dan ditolak daripada deposit.",
        home: "Utama",
        lost: "Hilang link?",
      }
    : {
        eyebrow: "My booking",
        lookupTitle: "Open your booking",
        lookupIntro: "Enter the email you booked with — we'll open your latest booking right away.",
        email: "Email",
        pick: "You have more than one booking — choose one",
        open: "Open my booking",
        opening: "Opening…",
        emailMeLink: "Email me the link instead",
        loading: "Opening your booking…",
        hi: "Hi",
        ref: "Booking reference",
        nextStep: "Your next step",
        needDeposit: "Upload your payment receipt",
        needDepositBody: "We haven't received your payment receipt yet. Pay with the QR / bank details below, then upload the receipt here — no need to book again.",
        needBalance: "Upload your room balance receipt",
        needBalanceBody: "Pay the remaining room rate with the QR / bank details below, then upload the receipt here.",
        reviewTitle: "Receipt received — we're checking it",
        reviewBody: "We're verifying your payment now. Uploaded the wrong file? You can upload again below.",
        paidTitle: "Fully paid ✓",
        paidBody: "Self check-in is via the key locker at the cabin.",
        lockerSoon: "Your key-locker code will be sent via WhatsApp / email on your check-in day.",
        lockerCode: "Locker code",
        amountDue: "Amount due",
        payQr: "Pay by QR / bank transfer",
        bank: "Bank transfer",
        qr: "DuitNow QR",
        uploadTitle: "Upload your receipt",
        uploadHint: "A screenshot or PDF of your payment is fine.",
        chooseAgain: "Wrong file? Upload again",
        submit: "Send receipt",
        uploading: "Sending…",
        uploaded: "Thank you! Your receipt has been sent.",
        cardTitle: "Pay by card (fastest)",
        cardBody: "Card payment confirms your booking instantly — no receipt upload needed.",
        cardCta: "Pay RM {amt} by card →",
        or: "Or — pay manually (admin approval required)",
        stay: "Your stay",
        cabin: "Cabin",
        checkIn: "Check-in",
        checkOut: "Check-out",
        guests: "Guests",
        roomRate: "Room rate",
        depositPaid: "Security deposit",
        balanceDue: "Room balance due",
        policy: "Check-out is by 12:00 PM. Late check-out is RM10 per hour (rounded up) and is deducted from your refundable security deposit.",
        home: "Home",
        lost: "Lost link?",
      };
}

function ManagePage() {
  const { id, token } = Route.useSearch();
  const navigate = useNavigate();
  const c = useCopy();
  const [b, setB] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [choices, setChoices] = useState<
    { bookingId: string; guestToken: string; reference: string; roomType: string; checkIn: string; status: string }[]
  >([]);

  async function load() {
    if (!id || !token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getBookingForGuest({ data: { bookingId: id, guestToken: token } });
      setB(data);
      rememberBooking({ id, token, reference: data.reference ?? "" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load booking");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id, token]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLookingUp(true);
    setChoices([]);
    try {
      const { bookings } = await getBookingByEmailAndReference({
        data: { email: lookupEmail.trim() },
      });
      if (bookings.length === 1) {
        const only = bookings[0]!;
        navigate({ to: "/manage-booking", search: { id: only.bookingId, token: only.guestToken } });
      } else {
        setChoices(bookings);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not find booking");
    } finally {
      setLookingUp(false);
    }
  }

  // Which receipt does this booking still need?
  const stage: "deposit" | "review" | "balance" | "paid" | null = !b
    ? null
    : b.status === "fully_paid"
      ? "paid"
      : b.status === "pending_payment"
        ? "deposit"
        : b.status === "awaiting_review" || (b.balancePaidAt && !done)
          ? "review"
          : "balance";

  const dueAmount =
    !b ? 0 : stage === "deposit" ? b.securityDeposit : b.remaining;

  async function upload() {
    if (!file || !b) return;
    setUploading(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const isDeposit = stage === "deposit" || (stage === "review" && !b.balancePaidAt);
      const prefix = isDeposit ? "proof" : "balance";
      const path = `bookings/${b.id}/${prefix}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      if (isDeposit) {
        await attachPaymentProof({ data: { bookingId: b.id, reference: b.reference ?? "", path } });
      } else {
        await attachBalanceProof({ data: { bookingId: b.id, guestToken: token, path } });
      }
      setDone(true);
      setFile(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const payBlock = b ? (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-background p-4 text-sm">
        <p className="text-[10px] uppercase tracking-widest text-stone">{c.bank}</p>
        <p className="mt-1 font-display text-base text-forest">CIMB Bank</p>
        <p className="mt-2 font-mono text-base">8600095810</p>
        <p className="text-stone">Mohd Fauzi Awang</p>
        <p className="mt-3 text-xs text-stone">{c.ref}: <strong className="font-mono text-forest">{b.reference}</strong></p>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-[10px] uppercase tracking-widest text-stone">{c.qr}</p>
        <img src={duitnowQrAsset.url} alt="DuitNow QR" className="mt-2 aspect-square w-full rounded-md object-contain" />
      </div>
    </div>
  ) : null;

  const uploadBlock = (
    <div className="mt-5 rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-medium text-forest">{c.uploadTitle}</p>
      <p className="mt-1 text-xs text-stone">{c.uploadHint}</p>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-4 block w-full text-sm"
      />
      <button
        onClick={upload}
        disabled={!file || uploading}
        className="mt-4 w-full rounded-full bg-forest px-7 py-4 text-sm font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60 sm:w-auto"
      >
        {uploading ? c.uploading : c.submit}
      </button>
      {done && <p className="mt-3 text-sm text-forest">{c.uploaded}</p>}
    </div>
  );

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
          <div className="flex items-center gap-5">
            <LanguageToggle variant="dark" />
            <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">{c.home}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 lg:px-10 lg:py-16">
        {loading && <p className="text-stone">{c.loading}</p>}

        {!id || !token ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{c.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl text-forest">{c.lookupTitle}</h1>
            <p className="mt-3 text-foreground/75">{c.lookupIntro}</p>
            <form onSubmit={lookup} className="mt-8 max-w-md space-y-5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.25em] text-stone">{c.email}</span>
                <input
                  type="email"
                  required
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-base focus:border-forest focus:outline-none"
                  autoComplete="email"
                />
              </label>
              {err && (
                <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
              )}
              <button
                type="submit"
                disabled={lookingUp}
                className="w-full rounded-full bg-forest px-7 py-4 text-sm font-medium text-coconut hover:bg-forest/90 disabled:opacity-60"
              >
                {lookingUp ? c.opening : c.open}
              </button>
              {choices.length > 1 && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="px-1 text-[11px] uppercase tracking-[0.25em] text-stone">{c.pick}</p>
                  <ul className="mt-2 divide-y divide-border">
                    {choices.map((ch) => (
                      <li key={ch.bookingId}>
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ to: "/manage-booking", search: { id: ch.bookingId, token: ch.guestToken } })
                          }
                          className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-coconut/60"
                        >
                          <span>
                            <span className="block font-mono text-sm text-forest">{ch.reference || ch.bookingId.slice(0, 8)}</span>
                            <span className="block text-xs text-stone">{ch.roomType} · {ch.checkIn}</span>
                          </span>
                          <span className="text-stone">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-stone">
                <Link to="/find-booking" className="underline text-forest">{c.emailMeLink}</Link>
              </p>
            </form>
          </div>
        ) : null}

        {err && id && token && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
        )}

        {b && (
          <>
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{c.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl text-forest">{c.hi} {b.guestName.split(" ")[0]},</h1>
            <p className="mt-3 text-foreground/75">
              {c.ref} <span className="font-mono text-forest">{b.reference ?? b.id.slice(0, 8)}</span>
            </p>

            {/* ===== Next step — always first, always one clear action ===== */}
            {stage === "paid" ? (
              <div className="mt-8 rounded-2xl border border-forest/30 bg-coconut p-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-forest">{c.paidTitle}</p>
                <h2 className="mt-2 font-display text-2xl text-forest">{c.paidBody}</h2>
                {b.lockerCode ? (
                  <p className="mt-4 rounded-xl bg-card px-5 py-4 font-mono text-2xl text-forest">
                    {c.lockerCode}: {b.lockerCode}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-stone">{c.lockerSoon}</p>
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border-2 border-forest/40 bg-coconut p-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-forest">{c.nextStep}</p>
                <h2 className="mt-2 font-display text-2xl text-forest">
                  {stage === "review" ? c.reviewTitle : stage === "deposit" ? c.needDeposit : c.needBalance}
                </h2>
                <p className="mt-2 text-sm text-foreground/80">
                  {stage === "review" ? c.reviewBody : stage === "deposit" ? c.needDepositBody : c.needBalanceBody}
                </p>

                {stage !== "review" && (
                  <>
                    <p className="mt-5 text-xs uppercase tracking-widest text-stone">{c.amountDue}</p>
                    <p className="font-display text-3xl text-forest">RM {dueAmount.toFixed(2)}</p>

                    {isPaymentsConfigured() && (
                      <div className="mt-5 rounded-xl border border-forest/30 bg-card p-4">
                        <p className="text-sm font-medium text-forest">{c.cardTitle}</p>
                        <p className="mt-1 text-xs text-stone">{c.cardBody}</p>
                        <Link
                          to="/checkout"
                          search={{ id: b.id, token, kind: stage === "deposit" ? "deposit" : "balance" }}
                          className="mt-3 inline-block rounded-full bg-forest px-6 py-3 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90"
                        >
                          {c.cardCta.replace("{amt}", dueAmount.toFixed(2))}
                        </Link>
                      </div>
                    )}

                    <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-stone">{c.or}</p>
                    <p className="mt-3 text-sm font-medium text-forest">{c.payQr}</p>
                    {payBlock}
                  </>
                )}

                {uploadBlock}
              </div>
            )}

            {/* ===== Stay details ===== */}
            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{c.stay}</p>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-stone">{c.cabin}</dt>
                <dd>
                  {b.rooms && b.rooms.length > 1 ? (
                    <ul className="flex flex-col gap-0.5">
                      {b.rooms.map((r) => (<li key={r.id}>{r.name}</li>))}
                    </ul>
                  ) : (
                    b.roomType
                  )}
                </dd>
                <dt className="text-stone">{c.checkIn}</dt><dd>{b.checkIn} (3:00 PM)</dd>
                <dt className="text-stone">{c.checkOut}</dt><dd>{b.checkOut} (12:00 PM)</dd>
                <dt className="text-stone">{c.guests}</dt><dd>{b.guests} · {b.nights ?? "—"} night(s)</dd>
                <dt className="text-stone">{c.roomRate}</dt><dd>RM {b.total.toFixed(2)}</dd>
                <dt className="text-stone">{c.depositPaid}</dt><dd>RM {b.securityDeposit.toFixed(2)}</dd>
                <dt className="font-medium text-stone">{c.balanceDue}</dt>
                <dd className="font-medium text-forest">RM {b.remaining.toFixed(2)}</dd>
              </dl>
              <p className="mt-3 text-xs text-stone">{c.policy}</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
