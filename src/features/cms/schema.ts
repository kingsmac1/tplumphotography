import { SEED, type DocKey, type PageKey } from "@/cms/types";

/**
 * The CMS editor is driven by the shape of the seed (the exact WordPress content). Every field's kind is
 * inferred from its seed value, and the editor can only change values, never add, remove or rename keys.
 * That is what keeps the layout fixed: the page components always receive the shape they were built for.
 */

export type FieldKind = "text" | "textarea" | "rich" | "url" | "number" | "image" | "images" | "items" | "strings" | "group";

/** One entry in the Website list. Several entries can edit different parts of the same document ("site"). */
export type PageDef = {
  id: string;
  doc: DocKey;
  label: string;
  /** Public address, shown and used for "Open page". */
  path: string;
  /** Which page the live preview shows. */
  preview: PageKey;
  /** Top-level keys of the document this entry edits (in order). Omitted = every key, SEO last. */
  keys?: string[];
  blurb: string;
};

export const PAGES: PageDef[] = [
  { id: "home", doc: "home", label: "Home", path: "/", preview: "home", blurb: "Hero slider, intro, about, quote, candid moments, wedding stories, video section, testimonials, recent work, call to action" },
  { id: "portfolio", doc: "portfolio", label: "Portfolio", path: "/portfolio/", preview: "portfolio", blurb: "Banner, gallery and booking strip" },
  { id: "wedding-stories", doc: "wedding-stories", label: "Wedding Stories", path: "/wedding-stories/", preview: "wedding-stories", blurb: "The couples' galleries: names, cover photo and every photo of their day (each couple gets its own page), plus the banner and booking strip" },
  { id: "videos", doc: "videos", label: "Video Portfolio", path: "/videos/", preview: "videos", blurb: "Banner, introduction and booking strip (the films themselves are in Dashboard → Videos)" },
  { id: "about", doc: "about", label: "About", path: "/about/", preview: "about", blurb: "Banner and profile" },
  { id: "contact", doc: "contact", label: "Contact", path: "/contact/", preview: "contact", blurb: "Banner, notes and the contact form's wording and options" },
  { id: "the-tplum-signature", doc: "the-tplum-signature", label: "The Tplum Signature", path: "/the-tplum-signature/", preview: "the-tplum-signature", blurb: "Banner, introduction and the process steps" },
  { id: "faq", doc: "faq", label: "FAQ", path: "/faq/", preview: "faq", blurb: "Questions and answers" },
  { id: "book", doc: "book", label: "Book", path: "/book/", preview: "book", blurb: "Booking page: banner, introduction, booking options and help band" },
  { id: "coming-soon", doc: "coming-soon", label: "Coming Soon", path: "/coming-soon/", preview: "coming-soon", blurb: "The holding page" },
  { id: "header", doc: "site", label: "Header & pop-out menu", path: "/", preview: "home", keys: ["brand", "header", "menu"], blurb: "Logos, site name, share image, the Book Now button and the menu links" },
  { id: "footer", doc: "site", label: "Footer & Instagram strip", path: "/", preview: "home", keys: ["instagramSection", "footer"], blurb: "Instagram strip (shown until the live feed is connected) and footer credit" },
  { id: "contact-details", doc: "site", label: "Contact details & social links", path: "/contact/", preview: "contact", keys: ["contact"], blurb: "Email, phone, Instagram and Facebook, used across the whole site" },
];

/** Section and field names the photographer sees. Anything not listed gets a readable version of its key. */
const LABELS: Record<string, string> = {
  seo: "Search & sharing (SEO)",
  albums: "Couples",
  children: "Sub-menu (shown under it in the menu)",
  stories: "Wedding stories (couple galleries)",
  cover: "Cover photo",
  photos: "Photos of their day",
  subtitle: "Under the names (e.g. Wedding, Engagement, a place)",
  title: "Title",
  description: "Description",
  ogTitle: "Share title (Facebook, WhatsApp…)",
  ogDescription: "Share description",
  twitterTitle: "Share title (X / Twitter)",
  twitterDescription: "Share description (X / Twitter)",
  shareImage: "Share image",
  hero: "Banner",
  slidesDesktop: "Slides (desktop & tablet)",
  slidesMobile: "Slides (phones)",
  intro: "Introduction",
  eyebrow: "Small heading above",
  body: "Text",
  heading: "Heading",
  button: "Button",
  label: "Label",
  href: "Link",
  url: "Link",
  quote: "Quote",
  text: "Text",
  image: "Image",
  imageMobile: "Image (phones)",
  imageTablet: "Image (tablets)",
  textMobile: "Text (phones)",
  candid: "Candid moments",
  recentWork: "Recent work",
  images: "Images",
  testimonials: "Testimonials",
  items: "Items",
  name: "Name",
  rating: "Stars (1–5)",
  source: "Source",
  cta: "Call to action",
  gallery: "Gallery",
  book: "Booking strip",
  profile: "Profile",
  form: "Contact form",
  labels: "Field labels",
  serviceOptions: "“What service” options",
  heardOptions: "“How did you hear about us” options",
  submit: "Submit button",
  header: "Header",
  bookButton: "Book Now button",
  options: "Booking options",
  help: "“Not sure” band",
  lead: "Text",
  success: "Message after sending",
  banner: "Banner image",
  process: "Process",
  steps: "Steps",
  question: "Question",
  answer: "Answer",
  contactLine: "Line under the questions",
  brand: "Logos & name",
  logoLight: "Logo (header)",
  menuLogo: "Logo (pop-out menu)",
  siteName: "Site name",
  menu: "Pop-out menu",
  contact: "Contact details",
  email: "Email",
  phone: "Phone",
  instagramUrl: "Instagram link",
  facebookUrl: "Facebook link",
  instagramHandle: "Instagram handle",
  instagramProfileUrl: "Instagram profile link (feed)",
  instagramSection: "Instagram strip",
  followText: "Follow line",
  posts: "Posts (shown until the live feed is connected)",
  caption: "Caption",
  footer: "Footer",
  copyright: "Copyright line",
  creditPrefix: "Credit text",
  creditLabel: "Credit name",
  creditUrl: "Credit link",
  // contact form labels
  first: "First name", last: "Last name", service: "Service question", others: "“Others” option", othersHelp: "“Others” hint",
  date: "Date question", location: "Location question", instagram: "Instagram question", instagramPlaceholder: "Instagram placeholder",
  heardFrom: "“How did you hear” question", message: "Message question",
};

/** Keys the photographer never edits (set automatically or fixed by the design). */
const HIDDEN = new Set(["ogType", "width", "height", "srcset", "focal"]);

/** Help text under particular fields. */
export const HELP: Record<string, string> = {
  "seo.title": "Shown in Google results and the browser tab. About 50–60 characters.",
  "seo.description": "Shown under the title in Google. About 150 characters.",
  "contact.phone": "International format, e.g. +14035551234. Shown formatted on the site.",
  "hero.slidesDesktop": "Drag to reorder. Portrait images look best.",
  "hero.slidesMobile": "Drag to reorder. Shown on phones instead of the desktop slides.",
  "albums": "One card per couple on the home page and the Wedding Stories page; each opens a page with all their photos. The page address follows the names (Juwon & Femi → /wedding-stories/juwon-and-femi/).",
  "albums.photos": "Drag to reorder. Add as many photos of their day as you like.",
  "instagramSection.posts": "Once Instagram is connected (Dashboard → Instagram), the live posts replace these.",
};

export const labelFor = (key: string) =>
  LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

export const isHidden = (key: string) => HIDDEN.has(key);

const RICH = /<(p|ul|ol|li|strong|em|a|br)[\s/>]/i;
const URL_KEYS = /^(href|url)$|Url$/;

export const isImage = (v: unknown): v is { src: string; alt?: string } =>
  !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as { src?: unknown }).src === "string";

/** What kind of field a seed value is. */
export function kindOf(key: string, seed: unknown): FieldKind {
  if (typeof seed === "number") return "number";
  if (typeof seed === "string") {
    if (URL_KEYS.test(key)) return "url";
    if (RICH.test(seed)) return "rich";
    return seed.length > 90 || seed.includes("\n") || key === "text" || key === "answer" || key === "caption" ? "textarea" : "text";
  }
  if (Array.isArray(seed)) {
    const first = seed[0];
    if (isImage(first)) return "images";
    if (typeof first === "string") return "strings";
    return "items";
  }
  if (isImage(seed)) return "image";
  return "group";
}

/** A blank copy of a list item, used by "Add". Same keys as the seed item, empty values. */
export function blankLike<T>(sample: T): T {
  if (typeof sample === "string") return "" as T;
  if (typeof sample === "number") return sample;
  if (Array.isArray(sample)) return [] as T;
  if (isImage(sample)) return { src: "", alt: "" } as T;
  if (sample && typeof sample === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sample)) out[k] = k === "source" ? v : blankLike(v);
    return out as T;
  }
  return sample;
}

/** The sections (top-level keys) an entry shows, in page order. SEO goes last. Loose text keys become one section. */
export function sectionsFor(def: PageDef): { id: string; label: string; keys: string[] }[] {
  const seed = SEED[def.doc] as Record<string, unknown>;
  const keys = def.keys ?? Object.keys(seed);
  const out: { id: string; label: string; keys: string[] }[] = [];
  const loose: string[] = [];
  for (const k of keys) {
    if (isHidden(k)) continue;
    const kind = kindOf(k, seed[k]);
    if (kind === "group" || kind === "items" || kind === "images") out.push({ id: k, label: labelFor(k), keys: [k] });
    else loose.push(k);
  }
  if (loose.length) out.splice(def.doc === "faq" ? out.length : 0, 0, { id: "_text", label: "Page text", keys: loose });
  const seo = out.findIndex((s) => s.id === "seo");
  if (seo >= 0) out.push(...out.splice(seo, 1));
  return out;
}

/** A short title for a collapsed list item (first non-empty text field). */
export function itemTitle(item: unknown, i: number): string {
  if (item && typeof item === "object") {
    for (const k of ["question", "title", "name", "label", "caption", "text"]) {
      const v = (item as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    }
  }
  return `Item ${i + 1}`;
}

/** Links must stay safe and point somewhere real. Returns a warning, or "" if fine. */
export function checkUrl(v: string): string {
  const s = v.trim();
  if (!s) return "";
  if (/^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s()-]+|\/[^\s]*|#[\w-]*)$/i.test(s)) return "";
  return "Use a full address (https://…), a page path (/contact/), mailto: or tel:. Other links are ignored on the site.";
}
