/**
 * Bookings go to Tplum on WhatsApp: once a booking is saved, the client's WhatsApp opens with a message to Tplum
 * already written out (package, date, time, add-ons, total, contact details). Tplum confirms and arranges payment there.
 *
 * Browsers block a new tab opened after an `await`, so `prepareWhatsAppTab()` opens a blank tab during the click
 * itself and `sendToWhatsApp()` points it at WhatsApp once the booking is saved (or the current tab, if no tab was allowed).
 */

/** wa.me wants the number as digits only, with the country code (e.g. 14034935511). */
export const waNumber = (phone: string) => phone.replace(/[^\d]/g, "");

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

/** Lines of "Label: value", leaving out empty values. */
export const messageLines = (title: string, rows: [string, string | number | null | undefined][]) =>
  [title, "", ...rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "").map(([k, v]) => `${k}: ${v}`)].join("\n");

export const prepareWhatsAppTab = (): Window | null => {
  if (typeof window === "undefined") return null;
  try {
    const w = window.open("", "_blank");
    if (w) {
      w.opener = null;
      w.document.title = "Opening WhatsApp…";
      w.document.body.innerHTML = '<p style="font:16px system-ui;padding:24px">Opening WhatsApp…</p>';
    }
    return w;
  } catch {
    return null;
  }
};

/**
 * Points the prepared tab at WhatsApp. Without one (pop-ups blocked), the current tab goes to WhatsApp instead,
 * unless `stayIfBlocked` (the page is about to move on and shows an "Open WhatsApp" button there).
 */
export const sendToWhatsApp = (tab: Window | null, url: string, stayIfBlocked = false) => {
  if (tab && !tab.closed) tab.location.href = url;
  else if (!stayIfBlocked) window.location.href = url;
};

/** Keeps the message for the confirmation page's "Open WhatsApp again" button (this browser tab only). */
export const rememberWhatsApp = (bookingId: string, url: string) => {
  try {
    sessionStorage.setItem(`tplum-wa-${bookingId}`, url);
  } catch {
    /* storage blocked: the confirmation page simply shows no button */
  }
};

export const recallWhatsApp = (bookingId: string) => {
  try {
    return sessionStorage.getItem(`tplum-wa-${bookingId}`) || "";
  } catch {
    return "";
  }
};

export const closeTab = (tab: Window | null) => {
  try {
    tab?.close();
  } catch {
    /* already closed */
  }
};
