// WhatsApp business number for DMI bookings/contact/store/academy.
// Update WHATSAPP_NUMBER if the team changes lines.
export const WHATSAPP_NUMBER = "2349013962323"; // International format, no +, no spaces.

export const buildWhatsAppUrl = (message: string, phone: string = WHATSAPP_NUMBER) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

export const openWhatsApp = (message: string, phone: string = WHATSAPP_NUMBER) => {
  if (typeof window === "undefined") return;
  window.open(buildWhatsAppUrl(message, phone), "_blank", "noopener,noreferrer");
};
