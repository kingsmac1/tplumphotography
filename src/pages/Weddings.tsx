import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, X, ChevronLeft, ChevronRight, Calendar, MapPin } from "lucide-react";
import { IconInstagram as Instagram } from "@/site/icons";
import { useBusinessSettings, useWeddingPricing } from "@/lib/content";
import { depositFor } from "@/lib/pricing";
import type { WeddingPackage } from "@/data/weddingDefaults";
import { createBooking, type BookingPayload } from "@/lib/bookingLog";
import type { SiteContent } from "@/cms/types";
import { SEED } from "@/cms/types";

/** Simple fade-in wrapper (DMI's AnimatedSection). */
const AnimatedSection = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number; distance?: number }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6, delay }}>{children}</motion.div>
);

type Pkg = WeddingPackage;

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);

const ASPECTS = ["aspect-[2/3]", "aspect-[4/3]", "aspect-square", "aspect-[3/5]", "aspect-[3/4]"];

const Weddings = ({ site }: { site?: SiteContent }) => {
  const instagramUrl = site?.contact.instagramUrl ?? SEED.site.contact.instagramUrl;
  const { settings: business } = useBusinessSettings();
  const { loaded: pricingLoaded, packages: allPackages, extras: allExtras } = useWeddingPricing();
  const packages = pricingLoaded ? allPackages : [];
  const extrasList = pricingLoaded ? allExtras : [];
  // Gallery: the portfolio photos (managed in Dashboard -> Website -> Portfolio).
  const weddingImages = useMemo(() => SEED.portfolio.gallery.images.slice(0, 12).map((i) => i.src), []);
  const heroImage = SEED.portfolio.hero.image.src;

  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const weddingDateInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: "",
    partnerName: "",
    email: "",
    whatsapp: "",
    agree: false,
    weddingDate: "",
    venue: "",
    city: "",
    events: "one" as "one" | "two",
    extras: [] as string[],
    notes: "",
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = selectedPkg || lightboxIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedPkg, lightboxIndex]);

  const packageTotal = () => {
    if (!selectedPkg) return 0;
    const base = form.events === "two" && selectedPkg.twoEvents ? selectedPkg.twoEvents : selectedPkg.oneEvent;
    const extrasSum = form.extras.reduce((acc, n) => acc + (extrasList.find(e => e.name === n)?.price ?? 0), 0);
    return base + extrasSum;
  };


  const toggleExtra = (name: string) => {
    setForm(f => ({ ...f, extras: f.extras.includes(name) ? f.extras.filter(x => x !== name) : [...f.extras, name] }));
  };

  const [submitting, setSubmitting] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const submitForm = async () => {
    if (!selectedPkg || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    const base = form.events === "two" && selectedPkg.twoEvents ? selectedPkg.twoEvents : selectedPkg.oneEvent;
    const extrasSum = packageTotal() - base;
    const eventsLabel = form.events === "two" ? "Two days" : "One day";
    const payload: BookingPayload = {
      full_name: `${form.name}${form.partnerName ? ` & ${form.partnerName}` : ""}`,
      gender: "",
      shoot_type: "Wedding",
      shoot_date: form.weddingDate,
      shoot_time: "",
      phone: form.whatsapp,
      email: form.email,
      date_of_birth: "",
      social_handles: "",
      inspiration_links: "",
      notes: form.notes,
      location: form.city,
      shoot_setting: form.venue || "Wedding",
      selected_service: selectedPkg.name,
      service_price: String(base),
      service_pricing_mode: "wedding_package",
      outfits: "",
      selected_extras: form.extras.join(" | "),
      extra_edited_count: "",
      service_total: String(base),
      extras_total: String(extrasSum),
      grand_total: String(packageTotal()),
      service_summary: `${selectedPkg.name} (${eventsLabel})`,
      source: "wedding_form",
    };
    const res = await createBooking({ kind: "wedding", packageId: selectedPkg.id, days: form.events, extras: form.extras, client: payload, returnUrl: window.location.origin });
    if (!res.ok) { setSubmitting(false); setSubmitError(res.error); return; }
    if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
    window.location.href = `/booking/confirmed/?b=${res.bookingId}`;
  };
  const depositNow = selectedPkg && business.online_payments_enabled ? depositFor(packageTotal(), business) : 0;

  const formValid = form.name && form.email && form.whatsapp && form.weddingDate && form.agree;

  return (
    <div className="min-h-screen bg-background text-foreground">
      

      {/* HERO */}
      <section className="relative h-[88vh] min-h-[640px] w-full overflow-hidden">
        {heroImage && (
          <img src={heroImage} alt="Tplum Photography weddings" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 py-20 md:py-28">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white/80 tracking-[0.4em] text-xs md:text-sm mb-6"
          >
            2025 / 2026 RATE CARD
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-display text-white text-6xl md:text-8xl lg:text-9xl font-bold leading-[0.9]"
          >
            TPLUM<br />WEDDINGS
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-white/85 font-body max-w-xl mt-8 text-base md:text-lg"
          >
            Calgary | Edmonton | Toronto Wedding & Portrait Photographer + Destination Wedding
            Now accepting bookings for weddings in 2026.
          </motion.p>
          <motion.a
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-white/90 hover:text-white text-sm tracking-widest border border-white/40 hover:border-white px-5 py-3 transition-colors"
          >
            <Instagram className="w-4 h-4" /> @TPLUMPHOTOGRAPHY
          </motion.a>
        </div>
      </section>

      {/* INTRO */}
      <section className="py-20 px-6 md:px-16 lg:px-20 border-t border-border">
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
              THE TPLUM<br />SIGNATURE
            </h2>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <div className="font-body text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: SEED["the-tplum-signature"].intro.body }} />
            <p className="font-body text-muted-foreground leading-relaxed mt-6">Destination weddings | Available to travel</p>
          </AnimatedSection>
        </div>
      </section>

      {/* PACKAGES */}
      <section id="packages" className="py-20 px-6 md:px-16 lg:px-20 border-t border-border bg-muted/20">
        <AnimatedSection>
          <div className="flex justify-between items-end mb-14 max-w-6xl mx-auto">
            <h2 className="font-display text-4xl md:text-6xl font-bold">WEDDING<br />COLLECTIONS</h2>
            <span className="text-xs text-muted-foreground font-body tracking-widest hidden md:block">CLICK A CARD TO BOOK</span>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {packages.map((pkg, i) => (
            <AnimatedSection key={pkg.id} delay={i * 0.05}>
              <button
                onClick={() => setSelectedPkg(pkg)}
                className={`group text-left w-full h-full flex flex-col p-8 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  pkg.featured
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-foreground"
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-display text-3xl font-bold uppercase">{pkg.name}</h3>
                    <p className={`font-body text-sm mt-1 ${pkg.featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {pkg.tagline}
                    </p>
                  </div>
                  {pkg.featured && (
                    <span className="text-[10px] tracking-widest border border-primary-foreground/40 px-2 py-1">POPULAR</span>
                  )}
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {pkg.includes.map((line) => (
                    <li key={line} className="flex gap-2 text-sm font-body">
                      <Check size={16} className="shrink-0 mt-0.5" />
                      <span className={pkg.featured ? "text-primary-foreground/90" : "text-muted-foreground"}>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className={`pt-6 border-t ${pkg.featured ? "border-primary-foreground/20" : "border-border"}`}>
                  {pkg.singlePrice ? (
                    <p className="font-display text-3xl font-bold">{formatMoney(pkg.singlePrice)}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-display text-2xl font-bold">{formatMoney(pkg.oneEvent)} <span className="text-xs font-body font-normal opacity-70">/ one day</span></p>
                      {pkg.twoEvents && (
                        <p className="font-display text-xl font-bold opacity-80">{formatMoney(pkg.twoEvents)} <span className="text-xs font-body font-normal opacity-70">/ two days</span></p>
                      )}
                    </div>
                  )}
                  <p className={`mt-4 text-xs tracking-widest ${pkg.featured ? "text-primary-foreground" : "text-foreground"} group-hover:underline`}>
                    BOOK THIS PACKAGE →
                  </p>
                </div>
              </button>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* EXTRAS */}
      <section className="py-20 px-6 md:px-16 lg:px-20 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-10">ADD-ONS</h2>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {extrasList.map((e, i) => (
              <AnimatedSection key={e.name} delay={i * 0.05}>
                <div className="border border-border p-6 h-full">
                  <p className="font-body text-sm text-muted-foreground uppercase tracking-widest mb-2">{e.name}</p>
                  <p className="font-display text-2xl font-bold">{formatMoney(e.price)}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY (masonry) */}
      <section className="py-20 px-6 md:px-16 lg:px-20 border-t border-border">
        <AnimatedSection>
          <div className="flex justify-between items-end mb-12">
            <h2 className="font-display text-4xl md:text-6xl font-bold">WEDDING<br />GALLERY</h2>
            <span className="text-xs text-muted-foreground font-body tracking-widest hidden md:block">RECENT WORK</span>
          </div>
        </AnimatedSection>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {weddingImages.map((src, i) => (
            <AnimatedSection key={src} delay={i * 0.04} distance={40}>
              <motion.div
                className="break-inside-avoid overflow-hidden group cursor-pointer"
                onClick={() => setLightboxIndex(i)}
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", damping: 60, stiffness: 400 }}
              >
                <img
                  src={src}
                  alt={`Tplum Photography wedding ${i + 1}`}
                  className={`w-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out ${ASPECTS[i % ASPECTS.length]}`}
                  loading="lazy"
                />
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* TERMS */}
      <section className="py-20 px-6 md:px-16 lg:px-20 border-t border-border bg-muted/20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12">
          <AnimatedSection>
            <h3 className="font-display text-3xl font-bold mb-6">TERMS & CONDITIONS</h3>
            <div className="space-y-3 font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {business.booking_terms || "Your date is secured once your contract is signed and your retainer is paid."}
              {business.cancellation_policy ? `

${business.cancellation_policy}` : ""}
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <h3 className="font-display text-3xl font-bold mb-6">OUR PROCESS</h3>
            <ol className="space-y-2 font-body text-sm text-muted-foreground leading-relaxed">
              {SEED["the-tplum-signature"].process.steps.map((st) => <li key={st.title}>{st.title}</li>)}
            </ol>
          </AnimatedSection>
        </div>
      </section>

      

      {/* BOOKING MODAL */}
      <AnimatePresence>
        {selectedPkg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-lenis-prevent
            className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center px-4 overflow-y-auto overscroll-contain"
            onClick={() => setSelectedPkg(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background w-full max-w-2xl my-8 md:my-16 relative"
            >
              <button
                onClick={() => setSelectedPkg(null)}
                className="absolute top-4 right-4 z-10 p-2 hover:opacity-70"
                aria-label="Close"
              >
                <X size={22} />
              </button>

              <div className="p-8 md:p-10">
                <p className="text-xs tracking-widest text-muted-foreground mb-2">BOOK PACKAGE</p>
                <h3 className="font-display text-3xl md:text-4xl font-bold uppercase mb-1">{selectedPkg.name}</h3>
                <p className="font-body text-sm text-muted-foreground mb-6">{selectedPkg.tagline}</p>

                {selectedPkg.twoEvents && (
                  <div className="flex gap-2 mb-6">
                    {(["one", "two"] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, events: v }))}
                        className={`flex-1 py-3 text-sm tracking-widest border transition-colors ${
                          form.events === v ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"
                        }`}
                      >
                        {v === "one" ? `ONE DAY · ${formatMoney(selectedPkg.oneEvent)}` : `TWO DAYS · ${formatMoney(selectedPkg.twoEvents!)}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <input required placeholder="Your full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input placeholder="Partner's name" value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input required type="email" placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input required placeholder="Phone number *" type="tel" autoComplete="tel" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <div className="relative">
                    <input
                      ref={weddingDateInputRef}
                      required
                      type="date"
                      value={form.weddingDate}
                      onChange={e => setForm({ ...form, weddingDate: e.target.value })}
                      className="w-full border border-border px-4 pr-11 md:pr-4 py-3 bg-transparent text-foreground [color-scheme:light] focus:border-foreground outline-none text-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-11 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 md:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />
                    <button
                      type="button"
                      aria-label="Open wedding date picker"
                      onClick={() => {
                        const el = weddingDateInputRef.current;
                        if (!el) return;
                        el.focus();
                        if (typeof el.showPicker === "function") el.showPicker();
                      }}
                      className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground md:hidden"
                    >
                      <Calendar size={16} />
                    </button>
                  </div>
                  <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input placeholder="Venue" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm sm:col-span-2" />
                </div>

                <div className="mt-6">
                  <p className="text-xs tracking-widest text-muted-foreground mb-3">ADD-ONS (OPTIONAL)</p>
                  <div className="flex flex-wrap gap-2">
                    {extrasList.map(e => (
                      <button
                        key={e.name}
                        type="button"
                        onClick={() => toggleExtra(e.name)}
                        className={`text-xs px-3 py-2 border transition-colors ${
                          form.extras.includes(e.name) ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"
                        }`}
                      >
                        {e.name} · {formatMoney(e.price)}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="Anything else we should know? (theme, references, timing…)"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="mt-6 w-full border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm resize-none"
                />

                <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
                  <div>
                    <p className="text-xs tracking-widest text-muted-foreground">ESTIMATED TOTAL</p>
                    <p className="font-display text-2xl font-bold">{formatMoney(packageTotal())}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!formValid || submitting}
                    onClick={() => void submitForm()}
                    className="bg-foreground text-background px-4 py-2.5 text-xs tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {submitting ? "SENDING…" : depositNow > 0 ? "PAY RETAINER & BOOK" : "BOOK NOW"} <ArrowUpRight size={14} strokeWidth={1.5} />
                  </button>
                </div>
                {depositNow > 0 && <p className="text-xs mt-3">Retainer due now: <strong>{formatMoney(depositNow)}</strong> · balance due before your wedding</p>}
                <label className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} />
                  <span>I agree to the booking terms. Your date is secured once your contract is signed and your retainer is paid. Prices in CAD.</span>
                </label>
                {submitError && <p role="alert" className="text-xs text-destructive mt-2">{submitError}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxIndex !== null && weddingImages[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-primary/95 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }} className="absolute top-6 right-6 text-primary-foreground z-[120]" aria-label="Close"><X size={28} /></button>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + weddingImages.length) % weddingImages.length); }} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-primary-foreground z-[120]" aria-label="Previous"><ChevronLeft size={36} /></button>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % weddingImages.length); }} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-primary-foreground z-[120]" aria-label="Next"><ChevronRight size={36} /></button>
            <img src={weddingImages[lightboxIndex]} alt="" className="max-h-[85vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Weddings;
