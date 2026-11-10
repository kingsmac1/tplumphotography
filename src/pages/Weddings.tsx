import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, X, Instagram, ChevronLeft, ChevronRight, Calendar, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { galleryImagesBySlug } from "@/lib/gallery-images";
import { cmsImages, useCms } from "@/lib/cms";
import { openWhatsApp } from "@/lib/whatsapp";
import { useWeddingPricing } from "@/lib/content";
import { BOOKING_LOCATIONS } from "@/data/pricingDefaults";
import type { WeddingPackage } from "@/data/weddingDefaults";
import { logToSheet, logToSupabase, type BookingPayload } from "@/lib/bookingLog";

const DMI_WEDDINGS_IG = "https://www.instagram.com/dmi_weddings?igsh=bGZxM3pnMmR3cGJi";

type Pkg = WeddingPackage;

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(amount);

const ASPECTS = ["aspect-[2/3]", "aspect-[4/3]", "aspect-square", "aspect-[3/5]", "aspect-[3/4]"];

const Weddings = () => {
  const { loaded: pricingLoaded, packages: allPackages, extras: allExtras, configuredLocations } = useWeddingPricing();
  // Prices are per studio location, Uyo first. A location with no prices set up yet shows Uyo's list.
  const [location, setLocation] = useState("uyo");
  const priceLocation = configuredLocations.includes(location) ? location : "uyo";
  const locationLabel = location.charAt(0).toUpperCase() + location.slice(1);
  const packages = pricingLoaded ? allPackages.filter((p) => (p.location ?? "uyo") === priceLocation) : [];
  const extrasList = pricingLoaded ? allExtras.filter((e) => (e.location ?? "uyo") === priceLocation) : [];
  const cms = useCms();
  const weddingImages = useMemo(
    () => (cms.loaded ? cmsImages(cms.data, "wedding", galleryImagesBySlug["wedding"] ?? []) : (galleryImagesBySlug["wedding"] ?? [])),
    [cms],
  );
  const heroImage = weddingImages[0];

  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const weddingDateInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: "",
    partnerName: "",
    email: "",
    whatsapp: "",
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

  const changeLocation = (loc: string) => {
    setLocation(loc);
    // The open package belongs to the old location's price list.
    setSelectedPkg(null);
    setForm((f) => ({ ...f, extras: [] }));
  };

  const toggleExtra = (name: string) => {
    setForm(f => ({ ...f, extras: f.extras.includes(name) ? f.extras.filter(x => x !== name) : [...f.extras, name] }));
  };

  const [submitting, setSubmitting] = useState(false);

  const submitForm = async () => {
    if (!selectedPkg || submitting) return;
    setSubmitting(true);
    const base = form.events === "two" && selectedPkg.twoEvents ? selectedPkg.twoEvents : selectedPkg.oneEvent;
    const lines = [
      "*NEW DMI WEDDING BOOKING*",
      `*Pricing Location:* ${locationLabel}`,
      `*Package:* ${selectedPkg.name} — ${form.events === "two" ? "Two events" : "One event"}`,
      `*Base:* ${formatMoney(base)}`,
      `*Couple:* ${form.name}${form.partnerName ? ` & ${form.partnerName}` : ""}`,
      `*Email:* ${form.email}`,
      `*WhatsApp:* ${form.whatsapp}`,
      `*Wedding Date:* ${form.weddingDate}`,
      `*Venue:* ${form.venue}`,
      `*City:* ${form.city}`,
      `*Extras:* ${form.extras.length ? form.extras.join(", ") : "-"}`,
      `*Notes:* ${form.notes || "-"}`,
      `*TOTAL: ${formatMoney(packageTotal())}*`,
    ];

    // Log to the Sheet (which also adds the wedding date to Google Calendar) and the dashboard.
    const extrasSum = packageTotal() - base;
    const eventsLabel = form.events === "two" ? "Two events" : "One event";
    const payload: BookingPayload = {
      full_name: `${form.name}${form.partnerName ? ` & ${form.partnerName}` : ""}`,
      gender: "",
      shoot_type: `Wedding - ${selectedPkg.name}`,
      shoot_date: form.weddingDate,
      shoot_time: "",
      phone: form.whatsapp,
      email: form.email,
      date_of_birth: "",
      social_handles: "",
      inspiration_links: form.notes,
      location: form.city || locationLabel,
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
      service_summary: `${selectedPkg.name} (${eventsLabel}) - ${formatMoney(base)} · ${locationLabel} pricing`,
      source: "wedding_form",
    };
    await logToSheet(payload);
    await logToSupabase(payload);
    setSubmitting(false);
    openWhatsApp(lines.join("\n"));
  };

  const formValid = form.name && form.email && form.whatsapp && form.weddingDate;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* HERO */}
      <section className="relative h-[88vh] min-h-[640px] w-full overflow-hidden">
        {heroImage && (
          <img src={heroImage} alt="DMI Weddings" className="absolute inset-0 h-full w-full object-cover" />
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
            DMI<br />WEDDINGS
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-white/85 font-body max-w-xl mt-8 text-base md:text-lg"
          >
            Timeless imagery of your special day, captured across Nigeria.
            Now accepting bookings for weddings in 2026.
          </motion.p>
          <motion.a
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            href={DMI_WEDDINGS_IG}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-white/90 hover:text-white text-sm tracking-widest border border-white/40 hover:border-white px-5 py-3 transition-colors"
          >
            <Instagram size={16} /> @DMI_WEDDINGS
          </motion.a>
        </div>
      </section>

      {/* INTRO */}
      <section className="py-20 px-6 md:px-16 lg:px-20 border-t border-border">
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
              CAPTURING<br />YOUR FOREVER
            </h2>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <p className="font-body text-muted-foreground leading-relaxed mb-6">
              When it comes to photographing your special day, collaboration is key. From your first message on
              WhatsApp to the final delivery of your gallery, DMI is with you — getting to know you and your
              partner, understanding your desired wedding style so that every frame captures it perfectly.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed">
              On the day itself, we aim to be stress-free and informative. We arrive early, quietly document
              the getting-ready moments, the ceremony, speeches and cake-cutting, and stay through until your
              last dance. With years of experience across celebrations all over Nigeria, we deliver imagery
              that will last a lifetime.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* PACKAGES */}
      <section id="packages" className="py-20 px-6 md:px-16 lg:px-20 border-t border-border bg-muted/20">
        <AnimatedSection>
          <div className="flex justify-between items-end mb-14 max-w-6xl mx-auto">
            <h2 className="font-display text-4xl md:text-6xl font-bold">WEDDING<br />PACKAGES</h2>
            <span className="text-xs text-muted-foreground font-body tracking-widest hidden md:block">CLICK A CARD TO BOOK</span>
          </div>
        </AnimatedSection>

        {/* Location tabs — same pattern as the Booking page */}
        <div className="max-w-6xl mx-auto mb-10">
          <div role="tablist" aria-label="Location" className="grid grid-cols-3 border-b border-border">
            {BOOKING_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                role="tab"
                aria-selected={location === loc.id}
                onClick={() => changeLocation(loc.id)}
                className={`flex items-center justify-center gap-2 py-4 font-display text-lg md:text-xl font-bold border-b-2 -mb-px transition-colors ${
                  location === loc.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin size={16} /> {loc.name}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground font-body mt-4">Showing {locationLabel} prices.</p>
        </div>

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
                      <p className="font-display text-2xl font-bold">{formatMoney(pkg.oneEvent)} <span className="text-xs font-body font-normal opacity-70">/ one event</span></p>
                      {pkg.twoEvents && (
                        <p className="font-display text-xl font-bold opacity-80">{formatMoney(pkg.twoEvents)} <span className="text-xs font-body font-normal opacity-70">/ two events</span></p>
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
                  alt={`DMI wedding ${i + 1}`}
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
            <ul className="space-y-3 font-body text-sm text-muted-foreground leading-relaxed">
              <li>• A non-refundable 70% deposit secures your booking. The 30% balance is due within 3 days after the event.</li>
              <li>• Kindly review our shooting and editing style before booking.</li>
              <li>• Client provides logistics and accommodation for destination events. A vehicle is provided for our team in your city.</li>
              <li>• Cancellations attract no refund. Postponed dates attract an extra $150,000.</li>
              <li>• Social-media previews delivered in 7 days. Full items delivered within 6 weeks.</li>
              <li>• Our work runs 6am–6pm. After-parties attract an extra $200,000.</li>
            </ul>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <h3 className="font-display text-3xl font-bold mb-6">CLIENT SATISFACTION</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
              Every aspect of your day must come together seamlessly. That's why DMI is the perfect partner for your
              wedding adventure — with years of experience capturing stunning images at celebrations all over Nigeria.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              We take great pride in setting up special shots to capture the unique atmosphere of your day, and deliver
              a skilled, experienced and professional service to ensure your wedding photos are of the highest quality.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <Footer />

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
                        {v === "one" ? `ONE EVENT · ${formatMoney(selectedPkg.oneEvent)}` : `TWO EVENTS · ${formatMoney(selectedPkg.twoEvents!)}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <input required placeholder="Your full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input placeholder="Partner's name" value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input required type="email" placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
                  <input required placeholder="WhatsApp number *" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} className="border border-border px-4 py-3 bg-transparent focus:border-foreground outline-none text-sm" />
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
                    {submitting ? "SENDING…" : "BOOK NOW"} <ArrowUpRight size={14} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  A 70% non-refundable deposit secures your date. We'll confirm availability on WhatsApp.
                </p>
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
