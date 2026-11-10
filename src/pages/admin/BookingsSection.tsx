import { useState } from "react";
import BookingTable from "./BookingTable";
import StudioSpaceTable from "./StudioSpaceTable";
import EventBookingTable from "./EventBookingTable";
import ManualBookingForm from "./ManualBookingForm";
import ManualStudioSpaceForm from "./ManualStudioSpaceForm";
import ManualEventBookingForm from "./ManualEventBookingForm";

type Tab = "all" | "photography" | "wedding" | "studio" | "events";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photography", label: "Photography" },
  { id: "wedding", label: "Wedding" },
  { id: "studio", label: "Studio Space" },
  { id: "events", label: "Events" },
];

const BookingsSection = ({ onDataChanged }: { onDataChanged: () => void }) => {
  const [tab, setTab] = useState<Tab>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showStudioForm, setShowStudioForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
    onDataChanged();
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-body font-bold tracking-widest border whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "all" && <BookingTable key={"all-" + refreshKey} title="All Bookings" onAdd={() => setShowBookingForm(true)} />}
      {tab === "photography" && <BookingTable key={"photo-" + refreshKey} title="Photography Bookings" restrictSource="booking_form" onAdd={() => setShowBookingForm(true)} />}
      {tab === "wedding" && <BookingTable key={"wedding-" + refreshKey} title="Wedding Bookings" restrictSource="wedding_form" onAdd={() => setShowBookingForm(true)} />}
      {tab === "studio" && <StudioSpaceTable key={"studio-" + refreshKey} onAdd={() => setShowStudioForm(true)} />}
      {tab === "events" && <EventBookingTable key={"events-" + refreshKey} onAdd={() => setShowEventForm(true)} />}

      {showBookingForm && (
        <ManualBookingForm onClose={() => setShowBookingForm(false)} onSuccess={handleSuccess} />
      )}
      {showStudioForm && (
        <ManualStudioSpaceForm onClose={() => setShowStudioForm(false)} onSuccess={handleSuccess} />
      )}
      {showEventForm && (
        <ManualEventBookingForm onClose={() => setShowEventForm(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
};

export default BookingsSection;
