// Content added on top of the WordPress copy (the client asked for a booking page and "Book now" buttons).
// Applied to src/cms/seed.json; safe to run more than once. build-seed.mjs runs it after regenerating the seed.
// Run: node scripts/seed-additions.mjs
import fs from "node:fs";

const FILE = new URL("../src/cms/seed.json", import.meta.url);
const seed = JSON.parse(fs.readFileSync(FILE, "utf8"));

/** Insert `key` into `obj` right after `after`, keeping key order (the CMS shows sections in key order). */
function insertAfter(obj, after, key, value) {
  if (key in obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === after) out[key] = value;
  }
  if (!(key in out)) out[key] = value;
  return out;
}

const BOOK = "/book/";
const pick = (img, alt) => ({ ...img, alt });
const pf = seed.portfolio.gallery.images;

// Header button (every page) and a menu link.
seed.site = insertAfter(seed.site, "brand", "header", { bookButton: { label: "BOOK NOW", href: BOOK } });
if (!seed.site.menu.items.some((i) => i.href === BOOK)) {
  const at = seed.site.menu.items.findIndex((i) => i.href === "/contact/");
  seed.site.menu.items.splice(at + 1, 0, { label: "Book Now", href: BOOK });
}

// Buttons next to the existing calls to action.
seed.home.cta = insertAfter(seed.home.cta, "button", "bookButton", { label: "BOOK NOW", href: BOOK });
seed.about.profile = insertAfter(seed.about.profile, "button", "bookButton", { label: "Book Now", href: BOOK });
seed.contact.intro = insertAfter(seed.contact.intro, "body", "bookButton", { label: "Book Now", href: BOOK });

// "CLICK HERE TO BOOK" bands now open the booking page.
seed.portfolio.book.href = BOOK;
seed["the-tplum-signature"].book.href = BOOK;

// The booking page.
if (!seed.book) {
  seed.book = {
    seo: {
      title: "Book → Tplum Photography",
      description: "Book your wedding, portrait or family session with Tplum Photography, Calgary | Edmonton | Toronto wedding & portrait photographer. Available to travel.",
      ogTitle: "Book → Tplum Photography",
      ogDescription: "Book your wedding, portrait or family session with Tplum Photography.",
      ogType: "article",
      twitterTitle: "Book → Tplum Photography",
      twitterDescription: "Book your wedding, portrait or family session with Tplum Photography.",
      shareImage: seed.portfolio.seo.shareImage,
    },
    hero: { heading: "Book Your Session", image: pick(pf[33], "Bride and groom by the lake") },
    intro: {
      heading: "How would you like to work with us?",
      body: "<p>Choose the kind of shoot you are planning to see packages, prices and available dates. You can reserve your date online in a few minutes.</p>",
    },
    options: [
      {
        title: "Weddings",
        text: "Wedding day coverage, elopements and vow renewals in Calgary, Edmonton, Toronto and beyond.",
        image: pick(pf[41], "Bride and groom smiling"),
        button: { label: "Book Now", href: "/booking/wedding/" },
      },
      {
        title: "Portrait & Family Sessions",
        text: "Portraits, couples, engagement, maternity and family sessions, in the studio or on location.",
        image: pick(pf[37], "Couple at an engagement picnic"),
        button: { label: "Book Now", href: "/booking/" },
      },
      {
        title: "Events",
        text: "Birthdays, corporate events and celebrations, quoted for your day.",
        image: pick(pf[27], "Guests celebrating at an event"),
        button: { label: "Book Now", href: "/events/" },
      },
    ],
    help: {
      heading: "Not sure which to choose?",
      text: "Tell us about your plans and we will help you pick the right package.",
      button: { label: "Get in Touch", href: "/contact/" },
    },
  };
}

// Tplum doesn't offer studio rental (client, 2026-11-16): make sure the booking page never lists it.
seed.book.options = seed.book.options.filter((o) => o.button.href !== "/studio-space/");

fs.writeFileSync(FILE, JSON.stringify(seed, null, 1));
console.log("seed additions applied");
