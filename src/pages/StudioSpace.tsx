import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FindStudio from "@/components/FindStudio";
import { openWhatsApp } from "@/lib/whatsapp";
import { logStudioSpaceToSheet, logStudioSpaceToSupabase, type StudioSpacePayload } from "@/lib/studioSpaceLog";
import { useStudioSpacePricing } from "@/lib/content";
import { supabase } from "@/lib/supabaseClient";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(amount);

const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const inputCls =
  "w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors";

const StudioSpace = () => {
  const pricing = useStudioSpacePricing();
  const spaces = pricing.loaded ? pricing.spaces : [];
  const allExtras = pricing.loaded ? pricing.extras : [];

  const [spaceId, setSpaceId] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [rentalDate, setRentalDate] = useState("");
  const [rentalTime, setRentalTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Private promo codes (e.g. a staff discount) — never listed anywhere on the site. A code
  // only works if the client already knows it and types it in here.
  const [couponInput, setCouponInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const chosenSpace = spaces.find((s) => s.id === spaceId);

  const extrasForSpace = useMemo(
    () => allExtras.map((e) => (e.followsSpace ? { ...e, price: chosenSpace?.price ?? 0 } : e)),
    [allExtras, chosenSpace],
  );

  const qtyOf = (id: string) => qty[id] ?? 1;
  const lineTotal = (id: string, price: number, maxQty?: number | null) => price * (maxQty ? qtyOf(id) : 1);

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const changeQty = (id: string, maxQty: number, delta: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.min(maxQty, Math.max(1, (prev[id] ?? 1) + delta)) }));
  };

  const selectedExtraObjects = selectedExtras.map((id) => extrasForSpace.find((e) => e.id === id)).filter((e): e is (typeof extrasForSpace)[number] => !!e);
  const extrasTotal = selectedExtraObjects.reduce((sum, e) => sum + lineTotal(e.id, e.price, e.max_qty), 0);
  const spaceTotal = chosenSpace?.price ?? 0;
  // A promo discounts the space price only, same rule as the main booking page's coupons.
  const discount = promo ? Math.round((spaceTotal * promo.percent) / 100) : 0;
  const grandTotal = spaceTotal + extrasTotal - discount;
  const couponNote = promo ? `Coupon ${promo.code} (${promo.percent}% off): -${formatMoney(discount)}` : "";

  // Clears the applied promo if the client changes space after applying it (price it was based on no longer applies).
  useEffect(() => { setPromo(null); setCouponMsg(null); setCouponInput(""); }, [spaceId]);

  // Applies automatically shortly after the client stops typing — no "apply" button, same as Booking.
  useEffect(() => {
    const code = couponInput.trim();
    if (promo || code.length < 3) {
      setCouponChecking(false);
      return;
    }
    let cancelled = false;
    setCouponChecking(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("validate_studio_space_promo", { p_code: code });
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
    return () => { cancelled = true; clearTimeout(timer); };
  }, [couponInput, promo]);

  const removeCoupon = () => {
    setPromo(null);
    setCouponMsg(null);
    setCouponInput("");
  };

  const canSubmit = !!chosenSpace && name.trim() && whatsapp.trim() && email.trim() && rentalDate;

  const buildPayload = (): StudioSpacePayload => ({
    full_name: name,
    phone: whatsapp,
    email,
    rental_date: rentalDate,
    rental_time: rentalTime,
    space_name: chosenSpace?.name ?? "",
    space_price: String(spaceTotal),
    duration_minutes: String(chosenSpace?.duration_minutes ?? 30),
    selected_extras: selectedExtraObjects.map((e) => (e.max_qty ? `${e.name} x${qtyOf(e.id)}` : e.name)).join(" | "),
    extras_total: String(extrasTotal),
    space_total: String(spaceTotal),
    grand_total: String(grandTotal),
    notes: couponNote ? `${notes ? `${notes}\n` : ""}${couponNote}` : notes,
    source: "studio_space_form",
  });

  const buildWhatsAppMessage = () => {
    const extrasList = selectedExtraObjects.map((e) =>
      e.max_qty ? `${e.name} x${qtyOf(e.id)} (${formatMoney(e.price)} each = ${formatMoney(lineTotal(e.id, e.price, e.max_qty))})` : `${e.name} (${formatMoney(e.price)})`,
    );
    const lines = [
      "*NEW DMI STUDIO SPACE RENTAL*",
      `*Name:* ${name}`,
      `*WhatsApp:* ${whatsapp}`,
      `*Email:* ${email}`,
      `*Date:* ${rentalDate}`,
      `*Time:* ${rentalTime}`,
      `*Space:* ${chosenSpace?.name} - ${formatMoney(spaceTotal)} (${chosenSpace?.description})`,
      `*Extras:* ${extrasList.length ? extrasList.join(", ") : "-"}`,
    ];
    if (notes.trim()) lines.push(`*Notes:* ${notes}`);
    if (promo) lines.push(`*Coupon:* ${promo.code} (-${formatMoney(discount)})`);
    lines.push(`*TOTAL: ${formatMoney(grandTotal)}*`);
    return lines.join("\n");
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const payload = buildPayload();
    await logStudioSpaceToSheet(payload);
    await logStudioSpaceToSupabase(payload);
    openWhatsApp(buildWhatsAppMessage());
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
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-4">REQUEST SENT</h1>
            <p className="text-muted-foreground font-body text-lg max-w-md mx-auto mb-4">
              Thanks {name}! We just opened WhatsApp with your rental details pre-filled — tap <span className="font-bold text-foreground">Send</span> in WhatsApp to confirm payment with our team. We've also emailed you a summary.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="w-full max-w-[280px] border border-border px-8 py-6 mx-auto">
                <p className="font-display text-2xl font-bold">{chosenSpace?.name}</p>
                <p className="font-display text-3xl font-bold text-accent mt-2">{formatMoney(grandTotal)}</p>
                <p className="text-sm text-muted-foreground font-body mt-1">{rentalDate} · {rentalTime}</p>
              </div>
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
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-2">RENT THE STUDIO</h1>
          <p className="text-muted-foreground font-body mb-10">
            Book our studio backdrop or content space by the half hour. Pick a space, add anything extra you need, then reserve your slot below.
          </p>

          {!pricing.loaded ? (
            <p className="text-sm font-body text-muted-foreground">Loading prices…</p>
          ) : (
            <>
              {/* Spaces */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {spaces.map((s) => {
                  const active = spaceId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSpaceId(s.id)}
                      aria-pressed={active}
                      className={`border p-6 text-left transition-colors flex flex-col ${
                        active ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                      }`}
                    >
                      <p className="text-xs font-body font-bold tracking-widest opacity-70">{s.name.toUpperCase()}</p>
                      <p className="font-display text-3xl font-bold mt-3">{formatMoney(s.price)}</p>
                      <p className="text-xs font-body opacity-70 mt-2 flex-1">{s.description}</p>
                      <span className="mt-5 inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest">
                        {active ? <><Check size={14} /> SELECTED</> : <>SELECT <ChevronRight size={14} /></>}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!chosenSpace ? (
                <p className="text-center text-sm font-body text-muted-foreground border border-dashed border-border py-10">
                  Select a space above to continue.
                </p>
              ) : (
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
                  <div className="border border-foreground bg-foreground text-background p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-body tracking-widest opacity-70">YOUR SPACE</p>
                      <p className="font-display text-xl md:text-2xl font-bold">{chosenSpace.name}</p>
                      <p className="text-xs font-body opacity-70 mt-1">{chosenSpace.description}</p>
                    </div>
                    <p className="font-display text-2xl md:text-3xl font-bold">{formatMoney(chosenSpace.price)}</p>
                  </div>

                  {/* Extras */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold mb-1">ADD EXTRAS</h2>
                      <p className="text-sm text-muted-foreground font-body">Optional add-ons for your session</p>
                    </div>
                    {extrasForSpace.map((extra) => {
                      const selected = selectedExtras.includes(extra.id);
                      return (
                        <div key={extra.id} className="space-y-3">
                          <button
                            onClick={() => toggleExtra(extra.id)}
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
                                <p className="text-xs font-body opacity-70 mt-0.5">{extra.description}</p>
                              </div>
                            </div>
                            <p className="font-display text-base font-bold">{extra.price ? formatMoney(extra.price) : "Same as space"}</p>
                          </button>
                          {selected && extra.max_qty && (
                            <div className="border border-border px-4 py-3 flex items-center justify-between gap-4">
                              <label className="text-xs font-body font-bold tracking-widest">HOW MANY · {extra.name.toUpperCase()}</label>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => changeQty(extra.id, extra.max_qty, -1)}
                                  disabled={qtyOf(extra.id) <= 1}
                                  className="w-9 h-9 border border-border hover:border-foreground font-body text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                  aria-label={`Decrease ${extra.name}`}
                                >
                                  −
                                </button>
                                <span className="font-display text-xl font-bold w-8 text-center">{qtyOf(extra.id)}</span>
                                <button
                                  type="button"
                                  onClick={() => changeQty(extra.id, extra.max_qty, 1)}
                                  disabled={qtyOf(extra.id) >= extra.max_qty}
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

                  {/* Details */}
                  <div className="space-y-5">
                    <h2 className="font-display text-2xl font-bold">YOUR DETAILS</h2>
                    <div>
                      <label className={labelCls}>FULL NAME *</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>WHATSAPP NUMBER *</label>
                      <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(403) 555-0123" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>EMAIL ADDRESS *</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>RENTAL DATE *</label>
                        <input type="date" value={rentalDate} onChange={(e) => setRentalDate(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>TIME</label>
                        <input type="time" value={rentalTime} onChange={(e) => setRentalTime(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>ANYTHING ELSE WE SHOULD KNOW?</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="Theme, references, timing..."
                        className="w-full border border-dashed border-border bg-background px-5 py-5 text-sm font-body outline-none focus:border-foreground transition-colors resize-y"
                      />
                    </div>
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

                  {/* Summary */}
                  <div className="border border-border p-5 space-y-2 font-body text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{chosenSpace.name}</span><span>{formatMoney(spaceTotal)}</span></div>
                    {selectedExtraObjects.map((e) => (
                      <div key={e.id} className="flex justify-between">
                        <span className="text-muted-foreground">{e.max_qty ? `${e.name} x${qtyOf(e.id)}` : e.name}</span>
                        <span>{formatMoney(lineTotal(e.id, e.price, e.max_qty))}</span>
                      </div>
                    ))}
                    {promo && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount ({promo.code} · {promo.percent}%)</span>
                        <span>-{formatMoney(discount)}</span>
                      </div>
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
                      canSubmit && !submitting ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {submitting ? "SUBMITTING…" : "REQUEST THIS SLOT"} <ChevronRight size={16} />
                  </button>
                  {!canSubmit && (
                    <p className="text-xs text-center text-muted-foreground font-body -mt-4">Fill in all fields marked * to submit.</p>
                  )}
                  <p className="text-[11px] text-muted-foreground font-body text-center">
                    This reserves your slot; we'll confirm availability and payment with you on WhatsApp.
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </section>
      <FindStudio />
      <Footer />
    </div>
  );
};

export default StudioSpace;
