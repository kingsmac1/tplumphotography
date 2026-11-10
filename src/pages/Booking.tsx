import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, MapPin, Plus, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FindStudio from "@/components/FindStudio";
import SlotPicker from "@/components/SlotPicker";
import { isSlotTaken, longDate, slotLabel } from "@/lib/schedule";
import { Link } from "@/lib/router-compat";
import { openWhatsApp } from "@/lib/whatsapp";
import { logToSheet, logToSupabase } from "@/lib/bookingLog";
import InspirationImages, { uploadInspiration } from "@/components/InspirationImages";
import { supabase } from "@/lib/supabaseClient";
import { useBookingPricing } from "@/lib/content";
import { BOOKING_LOCATIONS } from "@/data/pricingDefaults";

type LocationId = "lagos" | "abuja" | "uyo";
type SettingId = "indoor" | "outdoor";
type GroupId = string;

type ServiceOption = {
  id: GroupId;
  name: string;
  price: number;
  /** "bundle" = flat price. "per_outfit" = price multiplied by outfit count. */
  pricingMode: "bundle" | "per_outfit";
  desc: string;
};

type Extra = {
  name: string;
  price: number;
  desc: string;
  /** When set, the client picks a quantity (1..max) and the price is multiplied by it. */
  maxQty?: number;
  /** Costs the same as the package the client picked (e.g. Extra Outfit). */
  followsPackage?: boolean;
};

const locations = BOOKING_LOCATIONS as { id: LocationId; name: string }[];

const shootTypes = [
  "Portrait", "Pre-Wedding", "Birthday", "Graduation",
  "Fashion/Editorial", "Product", "Event", "Corporate", "Family",
];

const genderOptions = ["Male", "Female", "Prefer not to say"];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
// Year 2000 is a leap year, so Feb 29 stays selectable. Only day & month are captured.
const daysInMonth = (month: number) => new Date(2000, month, 0).getDate();

type SocialHandle = { platform: string; handle: string };

const platformOptions = ["Instagram", "Twitter", "TikTok", "Facebook", "YouTube", "LinkedIn"];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(amount);

const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const inputCls =
  "w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors";

const Booking = () => {
  const formRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<LocationId>("uyo");
  const [setting, setSetting] = useState<SettingId>("indoor");
  const [selectedService, setSelectedService] = useState<GroupId | "">("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [shootType, setShootType] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("");
  // Bumped when a submit finds the slot taken, so the calendar reloads.
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [slotError, setSlotError] = useState("");
  const pickSlot = useCallback((d: string, t: string) => {
    setShootDate(d);
    setShootTime(t);
    if (t) setSlotError("");
  }, []);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [socialHandles, setSocialHandles] = useState<SocialHandle[]>([{ platform: "Instagram", handle: "" }]);
  const [inspirationLinks, setInspirationLinks] = useState("");
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([]);
  const [imagesUploaded, setImagesUploaded] = useState(0);
  const [imagesFailed, setImagesFailed] = useState(0);
  const [outfits, setOutfits] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  const [couponInput, setCouponInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [publicPromos, setPublicPromos] = useState<{ code: string; percent: number; label: string | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pricing = useBookingPricing();
  const services: ServiceOption[] = useMemo(
    () =>
      pricing.loaded
        ? pricing.services
            .filter((r) => r.location === location && r.setting === setting)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => ({
              id: r.service_id,
              name: r.name,
              price: r.price,
              pricingMode: r.pricing_mode === "per_outfit" ? ("per_outfit" as const) : ("bundle" as const),
              desc: r.description,
            }))
        : [],
    [pricing.loaded, pricing.services, location, setting],
  );
  const chosenService = services.find((s) => s.id === selectedService);
  const packagePrice = chosenService?.price ?? 0;
  const availableExtras: Extra[] = useMemo(
    () =>
      pricing.loaded
        ? pricing.extras
            .filter((r) => r.location === location)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => ({
              name: r.name,
              price: r.follows_package ? packagePrice : r.price,
              desc: r.description,
              maxQty: r.max_qty ?? undefined,
              followsPackage: r.follows_package,
            }))
        : [],
    [pricing.loaded, pricing.extras, location, packagePrice],
  );
  const serviceTotal = chosenService
    ? chosenService.pricingMode === "per_outfit"
      ? chosenService.price * outfits
      : chosenService.price
    : 0;

  const qtyOf = (extraName: string) => extraQty[extraName] ?? 1;
  const extraLineTotal = (extra: Extra) => extra.price * (extra.maxQty ? qtyOf(extra.name) : 1);
  const extrasTotal = selectedExtras.reduce((sum, n) => {
    const extra = availableExtras.find((e) => e.name === n);
    return extra ? sum + extraLineTotal(extra) : sum;
  }, 0);
  const subtotal = serviceTotal + extrasTotal;
  // The discount applies to the package price only, never to extras.
  const discount = promo ? Math.round((serviceTotal * promo.percent) / 100) : 0;
  const grandTotal = subtotal - discount;
  const couponNote = promo ? `Coupon ${promo.code} (${promo.percent}% off): -${formatMoney(discount)}` : "";

  const settingLabel = setting.charAt(0).toUpperCase() + setting.slice(1);
  const locationLabel = (loc: LocationId) => loc.charAt(0).toUpperCase() + loc.slice(1);
  const birthdayLabel = birthMonth && birthDay ? `${Number(birthDay)} ${monthNames[Number(birthMonth) - 1]}` : "";

  const extraLabel = (extra: Extra) =>
    extra.maxQty ? `${extra.name} x${qtyOf(extra.name)}` : extra.name;
  const selectedExtraObjects = selectedExtras
    .map((n) => availableExtras.find((e) => e.name === n))
    .filter((e): e is Extra => !!e);

  const addSocialHandle = () => {
    const usedPlatforms = socialHandles.map((h) => h.platform);
    const next = platformOptions.find((p) => !usedPlatforms.includes(p));
    if (next) setSocialHandles([...socialHandles, { platform: next, handle: "" }]);
  };

  const removeSocialHandle = (index: number) => {
    setSocialHandles(socialHandles.filter((_, i) => i !== index));
  };

  const updateSocialHandle = (index: number, field: "platform" | "handle", value: string) => {
    const updated = [...socialHandles];
    updated[index] = { ...updated[index], [field]: value };
    setSocialHandles(updated);
  };

  const toggleExtra = (extraName: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraName) ? prev.filter((e) => e !== extraName) : [...prev, extraName]
    );
  };

  const changeQty = (extra: Extra, delta: number) => {
    setExtraQty((prev) => ({
      ...prev,
      [extra.name]: Math.min(extra.maxQty ?? 1, Math.max(1, (prev[extra.name] ?? 1) + delta)),
    }));
  };

  const chooseService = (id: GroupId) => {
    const firstPick = !selectedService;
    setSelectedService(id);
    if (firstPick) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  };

  useEffect(() => {
    setSelectedExtras((prev) => prev.filter((n) => availableExtras.some((extra) => extra.name === n)));
  }, [availableExtras]);

  // Promos the admin chose to advertise on the site (validated codes are checked separately).
  useEffect(() => {
    supabase.rpc("get_public_promos").then(({ data }) => {
      if (Array.isArray(data)) setPublicPromos(data);
    });
  }, []);

  // Coupons apply automatically shortly after the client stops typing (or pastes a code).
  useEffect(() => {
    const code = couponInput.trim();
    if (promo || code.length < 3) {
      setCouponChecking(false);
      return;
    }
    let cancelled = false;
    setCouponChecking(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("validate_promo", { p_code: code });
      if (cancelled) return;
      setCouponChecking(false);
      const found = Array.isArray(data) ? data[0] : null;
      if (error || !found) {
        setCouponMsg({ ok: false, text: "That code isn't valid or has expired." });
        return;
      }
      setPromo({ code: found.code, percent: Number(found.percent) });
      setCouponMsg({ ok: true, text: `${found.percent}% discount applied!` });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [couponInput, promo]);

  const removeCoupon = () => {
    setPromo(null);
    setCouponMsg(null);
    setCouponInput("");
  };

  const canSubmit =
    !!chosenService &&
    !!(name.trim() && gender && shootType && shootDate && shootTime && whatsapp.trim() && email.trim() && birthMonth && birthDay);

  const buildSheetPayload = () => {
    const socials = socialHandles
      .filter((h) => h.handle.trim())
      .map((h) => `${h.platform}: ${h.handle}`);
    const links = inspirationLinks
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const serviceLine = chosenService
      ? chosenService.pricingMode === "per_outfit"
        ? `${chosenService.name} - ${formatMoney(chosenService.price)} x ${outfits} outfit${outfits > 1 ? "s" : ""} = ${formatMoney(serviceTotal)}`
        : `${chosenService.name} - ${formatMoney(serviceTotal)} (${chosenService.desc})`
      : "-";
    const extraOutfits = availableExtras.filter((e) => e.followsPackage && selectedExtras.includes(e.name)).reduce((n, e) => n + qtyOf(e.name), 0);
    const extraEdited = selectedExtras.includes("Extra Edited Picture") ? qtyOf("Extra Edited Picture") : 0;

    return {
      full_name: name,
      gender,
      shoot_type: shootType,
      shoot_date: shootDate,
      shoot_time: shootTime,
      phone: whatsapp,
      email,
      // Only day & month are collected; the placeholder year 2000 keeps the value a valid date.
      date_of_birth: `2000-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`,
      social_handles: socials.join(" | "),
      inspiration_links: links.join(" | "),
      location: locationLabel(location),
      shoot_setting: settingLabel,
      selected_service: chosenService?.name ?? "",
      service_price: chosenService ? String(chosenService.price) : "",
      service_pricing_mode: chosenService?.pricingMode ?? "",
      // Total outfits = the outfits included in the package + any Extra Outfit add-ons.
      outfits: String(outfits + extraOutfits),
      selected_extras: selectedExtraObjects.map(extraLabel).join(" | "),
      extra_edited_count: String(extraEdited || 1),
      service_total: String(serviceTotal),
      extras_total: String(extrasTotal),
      grand_total: String(grandTotal),
      service_summary: couponNote ? `${serviceLine} | ${couponNote}` : serviceLine,
      source: "booking_form",
    };
  };

  const buildWhatsAppMessage = (uploaded = imagesUploaded) => {
    const socials = socialHandles
      .filter((h) => h.handle.trim())
      .map((h) => `${h.platform}: ${h.handle}`);
    const extrasList = selectedExtraObjects.map((e) =>
      e.maxQty
        ? `${e.name} x${qtyOf(e.name)} (${formatMoney(e.price)} each = ${formatMoney(extraLineTotal(e))})`
        : `${e.name} (${formatMoney(e.price)})`
    );

    const links = inspirationLinks
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const serviceLine = chosenService
      ? chosenService.pricingMode === "per_outfit"
        ? `${chosenService.name} - ${formatMoney(chosenService.price)} x ${outfits} outfit${outfits > 1 ? "s" : ""} = ${formatMoney(serviceTotal)}`
        : `${chosenService.name} - ${formatMoney(serviceTotal)} (${chosenService.desc})`
      : "-";

    const lines = [
      "*NEW DMI BOOKING*",
      `*Name:* ${name}`,
      `*Gender:* ${gender}`,
      `*WhatsApp:* ${whatsapp}`,
      `*Email:* ${email}`,
      `*Birthday:* ${birthdayLabel}`,
      `*Shoot Type:* ${shootType}`,
      `*Shoot Date:* ${longDate(shootDate)}`,
      `*Shoot Time:* ${slotLabel(shootTime)}`,
      `*Shoot Location:* ${locationLabel(location)} - ${settingLabel}`,
      `*Service:* ${serviceLine}`,
      `*Extras:* ${extrasList.length ? extrasList.join(", ") : "-"}`,
      `*Social Handles:* ${socials.length ? socials.join(" | ") : "-"}`,
    ];

    if (links.length > 0) {
      lines.push("*Inspiration Image Links:*");
      lines.push(...links.map((url, index) => `${index + 1}. ${url}`));
    }

    if (uploaded > 0) lines.push(`*Inspiration Images:* ${uploaded} uploaded with this booking`);
    if (couponNote) lines.push(`*${couponNote}*`);
    lines.push(`*TOTAL: ${formatMoney(grandTotal)}*`);

    return lines.join("\n");
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const payload = buildSheetPayload();
    // The database refuses a time someone else has just taken; stop before WhatsApp so the client picks again.
    const bookingId = crypto.randomUUID();
    const error = await logToSupabase(payload, bookingId);
    if (isSlotTaken(error)) {
      setSubmitting(false);
      setSlotError("Sorry, that time was just taken. Please pick another slot.");
      setSlotsVersion((v) => v + 1);
      document.getElementById("shoot-slot")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // a failed image never stops the booking: the client is told to send it on WhatsApp instead
    const images = error ? { uploaded: 0, failed: inspirationFiles.length } : await uploadInspiration(inspirationFiles, bookingId);
    setImagesUploaded(images.uploaded);
    setImagesFailed(images.failed);
    await logToSheet(payload);
    openWhatsApp(buildWhatsAppMessage(images.uploaded));
    setSubmitting(false);
    setSubmitted(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <section className="pt-32 pb-24 px-6 md:px-16 lg:px-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="w-20 h-20 rounded-full bg-accent mx-auto flex items-center justify-center mb-8">
              <Check size={36} className="text-accent-foreground" />
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-4">ALMOST THERE</h1>
            <p className="text-muted-foreground font-body text-lg max-w-md mx-auto mb-4">
              Thanks {name}! We just opened WhatsApp with your booking details pre-filled — tap <span className="font-bold text-foreground">Send</span> in WhatsApp to deliver it to our team.
            </p>
            {imagesFailed > 0 && (
              <p role="alert" className="text-sm font-body font-medium text-destructive max-w-md mx-auto mb-4">
                {imagesFailed} of your inspiration images could not be uploaded. Please send {imagesFailed === 1 ? "it" : "them"} to us on WhatsApp.
              </p>
            )}
            <div className="mt-8 flex flex-col items-center gap-4">
              {chosenService && (
                <div className="w-full max-w-[260px] border border-border px-8 py-6 mx-auto">
                  <p className="font-display text-2xl font-bold">{chosenService.name}</p>
                  <p className="font-display text-3xl font-bold text-accent mt-2">{formatMoney(grandTotal)}</p>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    {chosenService.pricingMode === "per_outfit"
                      ? `${outfits} outfit${outfits > 1 ? "s" : ""} · ${locationLabel(location)} ${setting}`
                      : `${chosenService.desc} · ${locationLabel(location)} ${setting}`}
                  </p>
                  {selectedExtras.length > 0 && (
                    <p className="text-xs text-muted-foreground font-body mt-2">
                      + {selectedExtras.length} extra{selectedExtras.length > 1 ? "s" : ""} ({formatMoney(extrasTotal)})
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => openWhatsApp(buildWhatsAppMessage())}
                className="text-xs font-body tracking-widest underline text-muted-foreground hover:text-foreground"
              >
                DIDN'T OPEN? CLICK TO OPEN AGAIN
              </button>
            </div>
          </motion.div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="pt-28 pb-24 px-6 md:px-16 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-2">PRICING & BOOKING</h1>
          <Link
            to="/weddings"
            className="group flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-accent text-accent-foreground px-6 py-6 md:px-10 md:py-8 my-6 transition-opacity hover:opacity-90"
          >
            <div>
              <p className="font-display text-2xl md:text-4xl font-bold leading-tight">
                BOOKING A WEDDING?
              </p>
              <p className="font-body text-base md:text-lg font-bold mt-1">
                Weddings, Pre-wedding, Court wedding &amp; more — book on our wedding page.
              </p>
            </div>
            <span className="inline-flex items-center justify-center gap-2 bg-background text-foreground px-8 py-4 font-body text-sm md:text-base font-bold tracking-widest shrink-0 group-hover:gap-4 transition-all">
              BOOK HERE <ChevronRight size={20} />
            </span>
          </Link>
          <p className="text-muted-foreground font-body mb-10">
            Pick your location, choose a package, then fill in your details to reserve your session.
          </p>

          {publicPromos.length > 0 && (
            <div className="mb-8 border border-dashed border-foreground px-5 py-4 text-center font-body text-sm">
              {publicPromos.map((p) => (
                <p key={p.code}>
                  <span className="font-bold">{p.label || `${p.percent}% OFF`}</span> — use code{" "}
                  <span className="font-display font-bold tracking-widest">{p.code}</span> at checkout for {p.percent}% off.
                </p>
              ))}
            </div>
          )}

          {/* Location tabs */}
          <div role="tablist" aria-label="Location" className="grid grid-cols-3 border-b border-border">
            {locations.map((loc) => (
              <button
                key={loc.id}
                role="tab"
                aria-selected={location === loc.id}
                onClick={() => setLocation(loc.id)}
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

          {/* Setting toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 mb-6">
            <p className="text-sm text-muted-foreground font-body">
              {location === "uyo" ? "Bundle includes 1 outfit & 3 edited images" : "Session rate"}
            </p>
            <div className="inline-flex border border-border">
              {(["indoor", "outdoor"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSetting(opt)}
                  className={`px-6 py-2 text-xs font-body font-bold tracking-widest transition-colors ${
                    setting === opt ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {opt === "indoor" ? "INDOOR · STUDIO" : "OUTDOOR · ON-LOCATION"}
                </button>
              ))}
            </div>
          </div>

          {!pricing.loaded && <p className="text-sm font-body text-muted-foreground mb-4">Loading prices…</p>}

          {/* Price cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((s) => {
              const active = selectedService === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => chooseService(s.id)}
                  aria-pressed={active}
                  className={`border p-6 text-left transition-colors flex flex-col ${
                    active ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                  }`}
                >
                  <p className="text-xs font-body font-bold tracking-widest opacity-70">{s.name.toUpperCase()}</p>
                  <p className="font-display text-3xl md:text-4xl font-bold mt-3">{formatMoney(s.price)}</p>
                  <p className="text-xs font-body opacity-70 mt-2 flex-1">{s.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest">
                    {active ? <><Check size={14} /> SELECTED</> : <>BOOK THIS <ChevronRight size={14} /></>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Extras price list */}
          <div className="mt-8 border border-border p-6">
            <p className="text-xs font-body font-bold tracking-widest mb-4">ADD-ONS · {locationLabel(location).toUpperCase()}</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {availableExtras.map((extra) => (
                <li key={extra.name} className="flex items-baseline justify-between gap-4 text-sm font-body">
                  <span>
                    {extra.name}
                    <span className="block text-xs text-muted-foreground">{extra.desc}</span>
                  </span>
                  <span className="font-display font-bold whitespace-nowrap">
                    {extra.price ? formatMoney(extra.price) : "Package price"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Booking form */}
          <div ref={formRef} className="scroll-mt-24 mt-12">
            {!chosenService ? (
              <p className="text-center text-sm font-body text-muted-foreground border border-dashed border-border py-10">
                Select a package above to start your booking.
              </p>
            ) : (
              <motion.div
                key="booking-form"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8 max-w-2xl mx-auto"
              >
                <div className="border border-foreground bg-foreground text-background p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-body tracking-widest opacity-70">YOUR PACKAGE</p>
                    <p className="font-display text-xl md:text-2xl font-bold">{chosenService.name}</p>
                    <p className="text-xs font-body opacity-70 mt-1">{locationLabel(location)} · {settingLabel}</p>
                  </div>
                  <p className="font-display text-2xl md:text-3xl font-bold">{formatMoney(chosenService.price)}</p>
                </div>

                <h2 className="font-display text-2xl md:text-3xl font-bold">TELL US ABOUT YOU</h2>

                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>FULL NAME *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>GENDER *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {genderOptions.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g)}
                          className={`border px-4 py-3 text-sm font-body transition-colors ${
                            gender === g ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>TYPE OF SHOOT *</label>
                    <div className="flex flex-wrap gap-2">
                      {shootTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => setShootType(type)}
                          className={`border px-4 py-2 text-xs font-body transition-colors ${
                            shootType === type ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div id="shoot-slot" className="scroll-mt-24">
                    <label className={labelCls}>SHOOT DATE & TIME *</label>
                    <SlotPicker date={shootDate} time={shootTime} onChange={pickSlot} refreshKey={slotsVersion} />
                    {slotError && <p className="mt-2 text-sm font-body text-destructive">{slotError}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>WHATSAPP NUMBER *</label>
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(403) 555-0123" className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>EMAIL ADDRESS *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                  </div>

                  {/* Birthday (day & month only) */}
                  <div>
                    <label className={labelCls}>BIRTHDAY *</label>
                    <div className="grid grid-cols-2 gap-4">
                      <select
                        value={birthMonth}
                        onChange={(e) => {
                          const m = e.target.value;
                          setBirthMonth(m);
                          if (m && Number(birthDay) > daysInMonth(Number(m))) setBirthDay("");
                        }}
                        aria-label="Birth month"
                        className={inputCls}
                      >
                        <option value="">Month</option>
                        {monthNames.map((m, i) => (
                          <option key={m} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={birthDay}
                        onChange={(e) => setBirthDay(e.target.value)}
                        aria-label="Birth day"
                        className={inputCls}
                      >
                        <option value="">Day</option>
                        {Array.from({ length: birthMonth ? daysInMonth(Number(birthMonth)) : 31 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>SOCIAL HANDLES</label>
                    {socialHandles.map((sh, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <select
                          value={sh.platform}
                          onChange={(e) => updateSocialHandle(idx, "platform", e.target.value)}
                          className="border border-border bg-background px-3 py-3 text-sm font-body outline-none w-36"
                        >
                          {platformOptions.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={sh.handle}
                          onChange={(e) => updateSocialHandle(idx, "handle", e.target.value)}
                          placeholder="@handle"
                          className="flex-1 border border-border bg-background px-4 py-3 text-sm font-body outline-none focus:border-foreground transition-colors"
                        />
                        {socialHandles.length > 1 && (
                          <button onClick={() => removeSocialHandle(idx)} className="px-3 text-muted-foreground hover:text-foreground" aria-label="Remove handle">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {socialHandles.length < platformOptions.length && (
                      <button onClick={addSocialHandle} className="text-xs font-body text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1">
                        <Plus size={12} /> Add another
                      </button>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>
                      INSPIRATION IMAGE LINKS
                      <span className="block font-normal normal-case tracking-normal text-[11px] text-muted-foreground mt-1">
                        Pinterest, Instagram, Facebook, or any image link is welcome — just paste the link to each inspiration photo.
                      </span>
                    </label>
                    <textarea
                      value={inspirationLinks}
                      onChange={(e) => setInspirationLinks(e.target.value)}
                      placeholder={"Paste one link per line\nhttps://www.pinterest.com/pin/abc123\nhttps://www.instagram.com/p/xyz789\nhttps://www.facebook.com/photo.php?fbid=123456"}
                      rows={5}
                      className="w-full border border-dashed border-border bg-background px-5 py-5 text-sm font-body outline-none focus:border-foreground transition-colors resize-y"
                    />
                    <InspirationImages files={inspirationFiles} onChange={setInspirationFiles} />
                  </div>
                </div>

                {chosenService.pricingMode === "per_outfit" && (
                  <div className="border border-border p-5">
                    <label className={labelCls}>NUMBER OF OUTFITS</label>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setOutfits(Math.max(1, outfits - 1))} className="w-10 h-10 border border-border hover:border-foreground font-body text-lg" aria-label="Decrease outfits">−</button>
                      <span className="font-display text-2xl font-bold w-10 text-center">{outfits}</span>
                      <button onClick={() => setOutfits(outfits + 1)} className="w-10 h-10 border border-border hover:border-foreground font-body text-lg" aria-label="Increase outfits">+</button>
                    </div>
                  </div>
                )}

                {/* Extras */}
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl md:text-3xl font-bold mb-1">ADD EXTRAS</h2>
                    <p className="text-sm text-muted-foreground font-body">Optional add-ons to enhance your session</p>
                  </div>
                  {availableExtras.map((extra) => {
                    const selected = selectedExtras.includes(extra.name);
                    return (
                      <div key={extra.name} className="space-y-3">
                        <button
                          onClick={() => toggleExtra(extra.name)}
                          className={`w-full border p-5 flex items-center justify-between transition-colors ${
                            selected ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                          }`}
                        >
                          <div className="text-left flex items-center gap-3">
                            <div className={`w-5 h-5 border flex items-center justify-center shrink-0 ${selected ? "border-background" : "border-current"}`}>
                              {selected && <Check size={12} />}
                            </div>
                            <div>
                              <p className="font-body text-sm font-bold">{extra.name}</p>
                              <p className="text-xs font-body opacity-70 mt-0.5">{extra.desc}</p>
                            </div>
                          </div>
                          <p className="font-display text-base font-bold">{formatMoney(extra.price)}</p>
                        </button>

                        {selected && extra.maxQty && (
                          <div className="border border-border px-4 py-3 flex items-center justify-between gap-4">
                            <label className="text-xs font-body font-bold tracking-widest">
                              HOW MANY · {extra.name.toUpperCase()}
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => changeQty(extra, -1)}
                                disabled={qtyOf(extra.name) <= 1}
                                className="w-9 h-9 border border-border hover:border-foreground font-body text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Decrease ${extra.name}`}
                              >
                                −
                              </button>
                              <span className="font-display text-xl font-bold w-8 text-center">{qtyOf(extra.name)}</span>
                              <button
                                type="button"
                                onClick={() => changeQty(extra, 1)}
                                disabled={qtyOf(extra.name) >= extra.maxQty}
                                className="w-9 h-9 border border-border hover:border-foreground font-body text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Increase ${extra.name}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Coupon */}
                <div>
                  <label className={labelCls}>COUPON CODE</label>
                  {promo ? (
                    <div className="flex items-center justify-between border border-foreground px-5 py-4 text-sm font-body">
                      <span><span className="font-bold tracking-widest">{promo.code}</span> · {promo.percent}% off applied</span>
                      <button onClick={removeCoupon} className="text-xs underline text-muted-foreground hover:text-foreground">REMOVE</button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value); setCouponMsg(null); }}
                      placeholder="Enter code — applied automatically"
                      className={inputCls + " uppercase"}
                    />
                  )}
                  {couponChecking && !promo && (
                    <p className="text-xs font-body mt-2 text-muted-foreground">Checking code…</p>
                  )}
                  {couponMsg && (
                    <p className={`text-xs font-body mt-2 ${couponMsg.ok ? "text-foreground" : "text-destructive"}`}>{couponMsg.text}</p>
                  )}
                </div>

                {/* Summary + submit */}
                <div className="border border-border p-5 space-y-2 font-body text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{chosenService.name} · {locationLabel(location)} {settingLabel}</span><span>{formatMoney(serviceTotal)}</span></div>
                  {selectedExtraObjects.map((e) => (
                    <div key={e.name} className="flex justify-between"><span className="text-muted-foreground">{extraLabel(e)}</span><span>{formatMoney(extraLineTotal(e))}</span></div>
                  ))}
                  {promo && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount ({promo.code} · {promo.percent}%)</span><span>-{formatMoney(discount)}</span></div>
                  )}
                  <div className="flex justify-between items-center border-t border-border pt-3 mt-3">
                    <span className="font-bold tracking-widest text-xs">TOTAL</span>
                    <span className="font-display text-2xl font-bold">{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className={`w-full flex items-center justify-center gap-2 px-8 py-4 text-sm font-body font-medium transition-colors ${
                    canSubmit && !submitting
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {submitting ? (inspirationFiles.length ? "UPLOADING IMAGES…" : "SUBMITTING…") : "SUBMIT BOOKING"} <ChevronRight size={16} />
                </button>
                {!canSubmit && (
                  <p className="text-xs text-center text-muted-foreground font-body -mt-4">
                    Fill in all fields marked * to submit.
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <FindStudio title="Visit the studio" />
      <Footer />
    </div>
  );
};

export default Booking;
