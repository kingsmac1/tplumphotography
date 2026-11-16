import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, MapPin, Plus, X } from "lucide-react";
import SlotPicker from "@/components/SlotPicker";
import { longDate, slotLabel } from "@/lib/schedule";
import { Link } from "@/lib/router-compat";
import InspirationImages, { uploadInspiration } from "@/components/InspirationImages";
import { supabase } from "@/lib/supabaseClient";
import { useBookingPricing, useBusinessSettings } from "@/lib/content";
import { depositFor, taxOn } from "@/lib/pricing";
import { createBooking } from "@/lib/bookingLog";
import { closeTab, messageLines, prepareWhatsAppTab, sendToWhatsApp, whatsappUrl } from "@/lib/whatsapp";

type SettingId = "indoor" | "outdoor";
type GroupId = string;

type ServiceOption = {
  id: GroupId;
  name: string;
  price: number;
  /** "bundle" = flat price. "per_outfit" = price multiplied by outfit count. */
  pricingMode: "bundle" | "per_outfit";
  desc: string;
  /** Session length in minutes (the calendar slot grows with "Extra 30 Minutes"). */
  minutes: number;
};

type Extra = {
  name: string;
  price: number;
  desc: string;
  /** When set, the client picks a quantity (1..max) and the price is multiplied by it. */
  maxQty?: number;
  /** Costs the same as the package the client picked (e.g. Extra Outfit). */
  followsPackage?: boolean;
  /** Minutes added to the session per unit (e.g. "Extra 30 Minutes"). */
  extraMinutes: number;
};

/** A package description written as "60 Mins Studio Session · Up to 2 Outfits · …" becomes a list of inclusions. */
const inclusions = (desc: string) => desc.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean);

const shootTypes = [
  "Portrait", "Engagement", "Maternity", "Proposal", "Couple",
  "Family", "Birthday", "Graduation", "Corporate", "Other",
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
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);

const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const inputCls =
  "w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors";

const Booking = () => {
  const formRef = useRef<HTMLDivElement>(null);
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
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { settings: business } = useBusinessSettings();
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
  // The prefilled WhatsApp message to Tplum, kept so the confirmation screen can open it again.
  const [waLink, setWaLink] = useState("");

  const pricing = useBookingPricing();
  const services: ServiceOption[] = useMemo(
    () =>
      pricing.loaded
        ? pricing.services
            .filter((r) => r.setting === setting)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => ({
              id: r.service_id,
              name: r.name,
              price: r.price,
              pricingMode: r.pricing_mode === "per_outfit" ? ("per_outfit" as const) : ("bundle" as const),
              desc: r.description,
              minutes: Number(r.duration_minutes) || 60,
            }))
        : [],
    [pricing.loaded, pricing.services, setting],
  );
  // Studio / On location tabs only when both kinds of package exist (Tplum's portrait packages are all studio).
  const settingsWithRows = useMemo(() => new Set(pricing.services.filter((r) => r.active !== false).map((r) => r.setting)), [pricing.services]);
  const hasBothSettings = settingsWithRows.has("indoor") && settingsWithRows.has("outdoor");
  useEffect(() => {
    if (settingsWithRows.size && !settingsWithRows.has(setting)) setSetting([...settingsWithRows][0] as SettingId);
  }, [settingsWithRows, setting]);
  const chosenService = services.find((s) => s.id === selectedService);
  const packagePrice = chosenService?.price ?? 0;
  const availableExtras: Extra[] = useMemo(
    () =>
      pricing.loaded
        ? pricing.extras
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => ({
              name: r.name,
              price: r.follows_package ? packagePrice : r.price,
              desc: r.description,
              maxQty: r.max_qty ?? undefined,
              followsPackage: r.follows_package,
              extraMinutes: Number(r.extra_minutes) || 0,
            }))
        : [],
    [pricing.loaded, pricing.extras, packagePrice],
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
  // Sales tax (GST) from Settings, on the discounted subtotal — the server charges exactly the same.
  const taxRule = business.booking_tax_enabled && Number(business.booking_tax_rate) > 0 ? { name: business.booking_tax_name || "GST", rate: Number(business.booking_tax_rate) } : null;
  const tax = taxOn(subtotal - discount, taxRule);
  const grandTotal = subtotal - discount + tax;
  // How long the session runs: the package plus any time-adding extras
  const sessionMinutes = (chosenService?.minutes ?? 60) + selectedExtras.reduce((m, n) => {
    const ex = availableExtras.find((e) => e.name === n);
    return ex ? m + ex.extraMinutes * (ex.maxQty ? qtyOf(ex.name) : 1) : m;
  }, 0);
  const couponNote = promo ? `Coupon ${promo.code} (${promo.percent}% off): -${formatMoney(discount)}` : "";

  const settingLabel = setting === "indoor" ? "Studio" : "On location";
  const depositNow = business.online_payments_enabled ? depositFor(grandTotal, business) : 0;
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
    !!(name.trim() && gender && shootType && shootDate && shootTime && phone.trim() && email.trim() && birthMonth && birthDay) && agree;

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
      phone,
      email,
      // Only day & month are collected; the placeholder year 2000 keeps the value a valid date.
      date_of_birth: `2000-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`,
      social_handles: socials.join(" | "),
      inspiration_links: links.join(" | "),
      location: "",
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

  const handleSubmit = async () => {
    if (!canSubmit || submitting || !chosenService) return;
    // Opened now, during the click, so the browser allows it; it is pointed at WhatsApp once the booking is saved.
    const waTab = business.online_payments_enabled ? null : prepareWhatsAppTab();
    setSubmitting(true);
    setSubmitError("");
    const payload = buildSheetPayload();
    // The server recalculates every price from the database, holds the slot for 30 minutes and starts Stripe Checkout for the deposit.
    const res = await createBooking({
      kind: "session",
      serviceId: chosenService.id,
      setting,
      outfits,
      extras: selectedExtraObjects.map((e) => ({ name: e.name, qty: e.maxQty ? qtyOf(e.name) : 1 })),
      promoCode: promo?.code ?? "",
      client: payload,
      returnUrl: typeof window !== "undefined" ? window.location.origin : "",
    });
    if (!res.ok) {
      closeTab(waTab);
      setSubmitting(false);
      if (res.code === "slot_taken") {
        setSlotError("Sorry, that time was just taken. Please pick another slot.");
        setSlotsVersion((v) => v + 1);
        document.getElementById("shoot-slot")?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else setSubmitError(res.error);
      return;
    }
    // a failed image never stops the booking: the client is told to email it instead
    const images = await uploadInspiration(inspirationFiles, res.bookingId);
    setImagesUploaded(images.uploaded);
    setImagesFailed(images.failed);
    if (res.checkoutUrl) { closeTab(waTab); window.location.href = res.checkoutUrl; return; }
    setSubmitting(false);
    setSubmitted(true);
    if (!business.online_payments_enabled) {
      const text = messageLines(`Hi Tplum, I just booked a portrait session on your website (ref ${res.reference}).`, [
        ["Name", name],
        ["Package", `${chosenService.name} (${formatMoney(serviceTotal)})`],
        ["Setting", hasBothSettings ? settingLabel : ""],
        ["Date", longDate(shootDate)],
        ["Time", `${slotLabel(shootTime, sessionMinutes)} (${sessionMinutes} mins)`],
        ["Shoot type", shootType],
        ["Add-ons", selectedExtraObjects.map((e) => `${extraLabel(e)} (${formatMoney(extraLineTotal(e))})`).join(", ")],
        ["Coupon", promo ? `${promo.code} (-${formatMoney(discount)})` : ""],
        [taxRule ? taxRule.name : "", tax > 0 ? formatMoney(tax) : ""],
        ["Total", formatMoney(grandTotal)],
        ["Phone", phone],
        ["Email", email],
      ]);
      const url = whatsappUrl(business.phone || "+14034935511", text);
      setWaLink(url);
      sendToWhatsApp(waTab, url);
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        
        <section className="pt-32 pb-24 px-6 md:px-16 lg:px-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="w-20 h-20 rounded-full bg-accent mx-auto flex items-center justify-center mb-8">
              <Check size={36} className="text-accent-foreground" />
            </div>
            <h1 className="font-display text-5xl md:text-7xl mb-4">Booking received</h1>
            <p className="text-muted-foreground font-body text-lg max-w-md mx-auto mb-4">
              Thanks {name}! Your session request is in{waLink ? <>. Send us the WhatsApp message that just opened and we'll confirm your session and arrange payment there.</> : <> and a confirmation is on its way to <span className="font-bold text-foreground">{email}</span>. We'll be in touch about payment and the final details.</>}
            </p>
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="m-btn inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 text-sm tracking-wide font-body font-medium mb-4">
                Open WhatsApp again <ChevronRight size={16} />
              </a>
            )}
            {imagesFailed > 0 && (
              <p role="alert" className="text-sm font-body font-medium text-destructive max-w-md mx-auto mb-4">
                {imagesFailed} of your inspiration images could not be uploaded. Please email {imagesFailed === 1 ? "it" : "them"} to info@tplumphotography.com.
              </p>
            )}
            <div className="mt-8 flex flex-col items-center gap-4">
              {chosenService && (
                <div className="w-full max-w-[260px] border border-border px-8 py-6 mx-auto">
                  <p className="font-display text-2xl font-bold">{chosenService.name}</p>
                  <p className="font-display text-3xl font-bold text-accent mt-2">{formatMoney(grandTotal)}</p>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    {chosenService.pricingMode === "per_outfit"
                      ? `${outfits} outfit${outfits > 1 ? "s" : ""} · ${settingLabel}`
                      : `${chosenService.desc} · ${settingLabel}`}
                  </p>
                  {selectedExtras.length > 0 && (
                    <p className="text-xs text-muted-foreground font-body mt-2">
                      + {selectedExtras.length} extra{selectedExtras.length > 1 ? "s" : ""} ({formatMoney(extrasTotal)})
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </section>
        
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      

      <section className="pt-28 pb-24 px-6 md:px-16 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-5xl md:text-7xl mb-2">Pricing &amp; Booking</h1>
          <Link
            to="/booking/wedding/"
            className="group flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-accent text-accent-foreground px-6 py-6 md:px-10 md:py-8 my-6 transition-opacity hover:opacity-90"
          >
            <div>
              <p className="font-display text-2xl md:text-4xl font-bold leading-tight">
                BOOKING A WEDDING?
              </p>
              <p className="font-body text-base md:text-lg font-bold mt-1">
                Weddings, elopements, vow renewals &amp; more — see our wedding collections.
              </p>
            </div>
            <span className="inline-flex items-center justify-center gap-2 bg-background text-foreground px-8 py-4 font-body text-sm md:text-base font-bold tracking-widest shrink-0 group-hover:gap-4 transition-all">
              BOOK HERE <ChevronRight size={20} />
            </span>
          </Link>
          <p className="text-muted-foreground font-body mb-10">
            {hasBothSettings ? "Choose studio or on location, pick a package, then fill in your details to reserve your session." : "Pick a package, then fill in your details to reserve your session."}
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

          {/* Setting toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 mb-6">
            <p className="text-sm text-muted-foreground font-body">
              {taxRule ? `Prices in Canadian dollars, plus ${taxRule.name}.` : "Prices in Canadian dollars."}
            </p>
            {hasBothSettings && <div className="inline-flex border border-border">
              {(["indoor", "outdoor"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSetting(opt)}
                  className={`px-6 py-2 text-xs font-body font-bold tracking-widest transition-colors ${
                    setting === opt ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {opt === "indoor" ? "STUDIO" : "ON LOCATION"}
                </button>
              ))}
            </div>}
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
                  <p className="font-display text-3xl md:text-4xl font-bold mt-3">
                    {formatMoney(s.price)}{taxRule && <span className="font-body text-sm font-normal opacity-70"> + {taxRule.name}</span>}
                  </p>
                  <ul className="text-sm font-body opacity-80 mt-4 space-y-1.5 flex-1">
                    {inclusions(s.desc).map((x) => <li key={x} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{x}</li>)}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest">
                    {active ? <><Check size={14} /> SELECTED</> : <>BOOK THIS <ChevronRight size={14} /></>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Extras price list */}
          <div className="mt-8 border border-border p-6">
            <p className="text-xs font-body font-bold tracking-widest mb-4">ADD-ONS</p>
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
            {business.session_note && <p className="mt-4 pt-4 border-t border-border text-sm font-body font-bold">{business.session_note}</p>}
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
                    <p className="text-xs font-body opacity-70 mt-1">{settingLabel}</p>
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
                    <SlotPicker date={shootDate} time={shootTime} onChange={pickSlot} refreshKey={slotsVersion} minutes={sessionMinutes} />
                    {slotError && <p className="mt-2 text-sm font-body text-destructive">{slotError}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>PHONE NUMBER *</label>
                    <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(403) 555-0123" className={inputCls} />
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
                    {business.session_note && <p className="text-sm font-body font-bold mt-2">{business.session_note}</p>}
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
                  <div className="flex justify-between"><span className="text-muted-foreground">{chosenService.name} · {settingLabel}</span><span>{formatMoney(serviceTotal)}</span></div>
                  {selectedExtraObjects.map((e) => (
                    <div key={e.name} className="flex justify-between"><span className="text-muted-foreground">{extraLabel(e)}</span><span>{formatMoney(extraLineTotal(e))}</span></div>
                  ))}
                  {promo && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount ({promo.code} · {promo.percent}%)</span><span>-{formatMoney(discount)}</span></div>
                  )}
                  {tax > 0 && taxRule && (
                    <div className="flex justify-between"><span className="text-muted-foreground">{taxRule.name} ({taxRule.rate}%)</span><span>{formatMoney(tax)}</span></div>
                  )}
                  <div className="flex justify-between items-center border-t border-border pt-3 mt-3">
                    <span className="font-bold tracking-widest text-xs">TOTAL</span>
                    <span className="font-display text-2xl font-bold">{formatMoney(grandTotal)}</span>
                  </div>
                  {depositNow > 0 && (
                    <>
                      <div className="flex justify-between pt-2"><span className="font-bold">Deposit due now</span><span className="font-bold">{formatMoney(depositNow)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Balance due before your session</span><span>{formatMoney(Math.max(0, grandTotal - depositNow))}</span></div>
                    </>
                  )}
                  <p className="text-[11px] text-muted-foreground pt-2">All prices in Canadian dollars (CAD).</p>
                  {!business.online_payments_enabled && (
                    <p className="text-[11px] text-muted-foreground">Nothing is paid online. When you book, WhatsApp opens with your booking details written out: send the message and we'll confirm your session and arrange payment.</p>
                  )}
                </div>

                <label className="flex items-start gap-3 text-sm font-body cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>
                    I agree to the booking terms{business.booking_terms ? ":" : "."}
                    {business.booking_terms && <span className="block text-xs text-muted-foreground mt-1 whitespace-pre-line">{business.booking_terms}</span>}
                    {business.cancellation_policy && <span className="block text-xs text-muted-foreground mt-1 whitespace-pre-line">{business.cancellation_policy}</span>}
                  </span>
                </label>
                {submitError && <p role="alert" className="text-sm font-body text-destructive">{submitError}</p>}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className={`w-full flex items-center justify-center gap-2 px-8 py-4 text-sm font-body font-medium transition-colors ${
                    canSubmit && !submitting
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {submitting ? (inspirationFiles.length ? "UPLOADING IMAGES…" : "SUBMITTING…") : depositNow > 0 ? `PAY ${formatMoney(depositNow)} DEPOSIT & BOOK` : business.online_payments_enabled ? "SUBMIT BOOKING" : "BOOK & SEND ON WHATSAPP"} <ChevronRight size={16} />
                </button>
                {!canSubmit && (
                  <p className="text-xs text-center text-muted-foreground font-body -mt-4">
                    Fill in all fields marked * and accept the booking terms to continue.
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default Booking;
