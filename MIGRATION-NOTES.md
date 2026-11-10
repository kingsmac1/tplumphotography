# Tplum Photography: migration notes and progress log

If the build is interrupted, read this file first and continue from the next unchecked item.
`[x]` = built **and** checked. `[~]` = built, not yet checked. `[ ]` = not done.

## Reference projects (all READ-ONLY, never edited)

| Project | Path | Used for |
|---|---|---|
| DMI | `/Users/macbook/Documents/Website Codes/dmi-website-project` (copy in `reference-copies/dmi`) | Dashboard, booking flows and calendar, clients, payments, client gallery, emails, studio rental, staff check-in, invoice generator |
| Nkopno Photography | `/Users/macbook/Documents/Website Codes/nkopno-photography-website-2` (copy in `reference-copies/nkopno`) | Instagram sync and feed |
| Illuszionz Media | `/Users/macbook/Documents/Website Codes/ILLUSZIONZ MEDIA` | **Not used**: DMI already has an invoice generator |

## Phase A checklist

### A1: capture of the WordPress site (`my-site-reference/`)
- [x] Page list: home, portfolio, about, contact, the-tplum-signature, faq, coming-soon
- [x] Rendered HTML (desktop + mobile) for every page: `html/`
- [x] CSS, fonts, JS: `raw/assets/`; computed styles: `styles/`
- [x] Images at largest size, including Instagram post images: `images/`
- [x] Interactive states (menu, slider, testimonials, galleries, lightbox, FAQ open/closed, form): `interactive/`
- [x] WordPress API: pages, posts, media, categories, tags: `wp-api/`
- [x] SEO title/description/OG/Twitter per page: `meta/`
- [x] Screenshots at 1440px and 390px: `screenshots/`
- [ ] Content inventory per page: `content-inventory/`
- Capture failures: none (`meta/capture-failures.json` and `wp-api/failures.json` are empty)

### A2: public site
- [~] TanStack Start + Vite + Tailwind on Cloudflare Workers (`@cloudflare/vite-plugin`), server-rendered
- [~] Home, Portfolio, About, Contact, The Tplum Signature, FAQ, Coming Soon (all content from CMS seed)
- [~] Pop-out menu, hero slider, testimonials, galleries + lightbox, FAQ accordion, contact form (honeypot, browser + server validation)
- [~] SEO tags per page, favicon, JSON-LD (LocalBusiness / ProfessionalService)
- [~] Instagram feed (shows captured posts until the token is added)
- [ ] Visual match check against originals at 1440 / 390

### A3: dashboard (from DMI)
- [~] Overview, Bookings, Calendar, Inquiries, Clients, Finance, Pricing, Promos, Emails, Team, Staff check-in, Settings
- [~] Booking flows: sessions (`/booking/`), weddings (`/booking/wedding/`), studio rental (`/studio-space/`), events (`/events/`)
- [~] Invoices: TPL-0001 numbering, line items, discounts, tax off by default, statuses, PDF, email, Stripe pay, payment tracking
- [~] Contracts + e-signing
- [~] Client galleries (R2), deliveries, client account area
- [~] Edge Functions (`supabase/functions/`), migrations (`supabase/migrations/`)
- [ ] Routes: `/admin/`, `/admin/login/`, `/account/`, `/checkin/`, `/client-gallery/$id/`, `/invoice/$token/`, `/contract/$token/`
- [ ] Booking flow compared side by side with DMI

### A4: CMS
- [~] Database: drafts, publish, revisions, restore, `site-images` bucket (migration `..._cms.sql`)
- [ ] Website section: page list, sections in order, every field editable, images (upload/replace/crop/alt), lists (add/remove/drag), SEO, site-wide contact/social
- [ ] Live preview, Publish, discard, restore earlier version

### A5: checks
- [ ] Visual match, content check, links/menus/sliders/lightbox/accordion/forms
- [x] Price, deposit, tax and invoice tests (`tests/`)
- [ ] Local Supabase (Docker), Lighthouse, production build

### A6: pause for keys
- [ ] `.secrets.local` with instructions; local preview; summary

## Phase B checklist
- [ ] Not started (waits for "keys added")

## DMI features and where they went

| DMI feature | Tplum location | Notes |
|---|---|---|
| Session booking flow + time slots | `src/pages/Booking.tsx`, `src/components/SlotPicker.tsx`, `src/lib/schedule.ts` | Same steps; no location picker |
| Wedding booking | `src/pages/Weddings.tsx` | |
| Studio space rental | `src/pages/StudioSpace.tsx` | |
| Event booking | `src/pages/EventBooking.tsx` | |
| Dashboard calendar | `src/pages/admin/CalendarSection.tsx` | |
| Bookings tables, manual bookings, edit/reschedule | `src/pages/admin/Booking*`, `Manual*Form.tsx`, `EditForm.tsx` | |
| Clients | `src/pages/admin/ClientsSection.tsx` | |
| Finance (income, expenses, other income) | `src/pages/admin/Finance*.tsx` | |
| Prices, packages, add-ons, promos | `PricingManager.tsx`, `PromoManager.tsx` | Sample prices marked "Sample: edit me" in dashboard only |
| Emails + templates + bulk messaging | `EmailsSection.tsx`, `EmailTemplatesPanel.tsx`, `MessagingPanel.tsx` | DMI's academy audience removed |
| Team + staff check-in + attendance | `TeamSection.tsx`, `src/pages/Checkin.tsx`, `Attendance*.tsx` | |
| Client gallery (proofing, watermark, picks, delivery) | `src/features/gallery/` | R2, own Tplum bucket |
| Deliveries | `src/features/delivery/` | |
| Client account area | `src/features/account/` | |
| Invoice generator | `src/features/invoices/` | DMI's, rebranded; tax + e-Transfer added |
| Not ported: academy, blog, store, reviews pages | n/a | Not part of Tplum's business |

## Placeholders the photographer needs to edit
- Sample packages and prices (Dashboard → Prices & Packages), marked "Sample: edit me"
- Invoice business details, Interac e-Transfer email, terms, footer text (Invoices → open an invoice → Save as default)
- Deposit rules, booking terms, cancellation policy, opening hours (Settings)
- Contract template wording (Contracts)

## Typos in the WordPress content (kept as-is, not fixed)
- (see Content inventory pass)

## Needs your decision
- (none yet)

## Session log
- 2026-11-10: Resumed after interruption. The build had stopped mid-A3: dashboard sections written but uncommitted, CMS editor (`src/features/cms/WebsiteSection`) missing, type errors, no admin/client routes. This file did not exist and was created now.
