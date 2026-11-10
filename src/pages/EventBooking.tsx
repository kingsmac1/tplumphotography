import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { openWhatsApp } from "@/lib/whatsapp";
import { logEventBookingToSheet, logEventBookingToSupabase, type EventBookingPayload } from "@/lib/eventBookingLog";
import { EVENT_TYPES, OTHER_EVENT_TYPE } from "@/data/eventTypes";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(amount);

const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const inputCls =
  "w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors";

const EventBooking = () => {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [eventChoice, setEventChoice] = useState("");
  const [eventOther, setEventOther] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [venue, setVenue] = useState("");
  const [guests, setGuests] = useState("");
  const [agreedAmount, setAgreedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const eventType = eventChoice === OTHER_EVENT_TYPE ? eventOther.trim() : eventChoice;
  const amount = Number(agreedAmount) || 0;

  const canSubmit =
    name.trim() && whatsapp.trim() && email.trim() && eventType && startDate && amount > 0;

  const buildPayload = (): EventBookingPayload => ({
    full_name: name,
    phone: whatsapp,
    email,
    event_type: eventType,
    event_start_date: startDate,
    event_end_date: endDate,
    event_time: startTime,
    venue,
    expected_guests: guests,
    agreed_amount: String(amount),
    notes,
    source: "event_form",
  });

  const buildWhatsAppMessage = () => {
    const lines = [
      "*NEW DMI EVENT BOOKING*",
      `*Name:* ${name}`,
      `*WhatsApp:* ${whatsapp}`,
      `*Email:* ${email}`,
      `*Event:* ${eventType}`,
      `*Dates:* ${startDate}${endDate ? ` to ${endDate}` : ""}${startTime ? ` at ${startTime}` : ""}`,
      `*Venue:* ${venue || "-"}`,
      `*Guests:* ${guests || "-"}`,
      `*Agreed amount:* ${formatMoney(amount)}`,
    ];
    if (notes.trim()) lines.push(`*Notes:* ${notes}`);
    return lines.join("\n");
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const payload = buildPayload();
    await logEventBookingToSheet(payload);
    await logEventBookingToSupabase(payload);
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
              Thanks {name}! We just opened WhatsApp with your event details pre-filled — tap <span className="font-bold text-foreground">Send</span> so our team can confirm the booking with you. We've also emailed you a summary.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="w-full max-w-[280px] border border-border px-8 py-6 mx-auto">
                <p className="font-display text-2xl font-bold">{eventType}</p>
                <p className="font-display text-3xl font-bold text-accent mt-2">{formatMoney(amount)}</p>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  {startDate}{endDate ? ` to ${endDate}` : ""}{startTime ? ` · ${startTime}` : ""}
                </p>
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
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-2">BOOK AN EVENT</h1>
          <p className="text-muted-foreground font-body mb-10">
            Tell us about your event and the dates you need. Our team will confirm the final arrangement with you on WhatsApp.
          </p>

          <div className="space-y-8">
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">YOUR DETAILS</h2>
              <div>
                <label className={labelCls}>FULL NAME *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>WHATSAPP NUMBER *</label>
                  <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(403) 555-0123" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>EMAIL ADDRESS *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">YOUR EVENT</h2>
              <div>
                <label className={labelCls}>TYPE OF EVENT *</label>
                <select value={eventChoice} onChange={(e) => setEventChoice(e.target.value)} className={inputCls}>
                  <option value="">Select an event type</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value={OTHER_EVENT_TYPE}>{OTHER_EVENT_TYPE}</option>
                </select>
              </div>
              {eventChoice === OTHER_EVENT_TYPE && (
                <div>
                  <label className={labelCls}>TELL US WHAT EVENT *</label>
                  <input type="text" value={eventOther} onChange={(e) => setEventOther(e.target.value)} placeholder="e.g. Charity gala" className={inputCls} />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>START DATE *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>END DATE</label>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>START TIME</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>VENUE / LOCATION</label>
                  <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Where the event is held" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>EXPECTED GUESTS</label>
                  <input type="number" min={0} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="e.g. 80" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold">AGREED AMOUNT</h2>
              <div>
                <label className={labelCls}>AMOUNT AGREED WITH THE STUDIO MANAGER ($) *</label>
                <input
                  type="number"
                  min={1}
                  value={agreedAmount}
                  onChange={(e) => setAgreedAmount(e.target.value)}
                  placeholder="e.g. 150000"
                  className={inputCls}
                />
                <p className="text-xs font-body text-muted-foreground mt-2">
                  Enter the price you agreed with the studio manager for this event. This page doesn't set a price for events.
                </p>
              </div>
              <div>
                <label className={labelCls}>ANYTHING ELSE WE SHOULD KNOW?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Setup needs, theme, timing..."
                  className="w-full border border-dashed border-border bg-background px-5 py-5 text-sm font-body outline-none focus:border-foreground transition-colors resize-y"
                />
              </div>
            </div>

            <div className="border border-border p-5 flex justify-between items-center font-body text-sm">
              <span className="font-bold tracking-widest text-xs">AGREED AMOUNT</span>
              <span className="font-display text-2xl font-bold">{amount > 0 ? formatMoney(amount) : "—"}</span>
            </div>

            <button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || submitting}
              className={`w-full py-5 font-body font-bold tracking-widest text-sm transition-colors ${
                canSubmit && !submitting ? "bg-foreground text-background hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {submitting ? "SENDING…" : "SUBMIT EVENT REQUEST"}
            </button>
            {!canSubmit && (
              <p className="text-xs font-body text-muted-foreground text-center">Fill in the fields marked * to submit.</p>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default EventBooking;
