/**
 * Everything brand-specific about the Tplum client gallery lives here (the gallery itself is DMI's, rebranded).
 * The server side has its own copy of the brand in supabase/functions/_shared/email-templates.ts (BRAND) and the
 * preview lifetime in supabase/functions/_shared/gallery.ts (PURGE_DAYS).
 */
const site = {
  name: 'Tplum Photography',
  url: 'https://tplumphotography.com',
  email: 'info@tplumphotography.com',
  phone: '+14034935511',
}

const env = import.meta.env as Record<string, string | undefined>

export const galleryConfig = {
  brandName: site.name,
  /** shown in the gallery's top bar and cover (dark backgrounds) */
  logoLight: '/brand/tplum-logo-white.png',
  /** shown on light backgrounds */
  logoDark: '/brand/tplum-logo-dark.png',

  /** prices in the gallery (the "all unedited images" option) */
  currency: '$',
  /** where client galleries live */
  galleryPath: '/client-gallery',

  siteUrl: (env.VITE_SITE_URL || site.url).replace(/\/$/, ''),
  ownerEmail: env.VITE_OWNER_EMAIL || site.email,
  /** studio phone for "call us" links */
  ownerPhone: site.phone,

  watermark: {
    /** the logo drawn on every proof image — a white logo on a transparent background works best */
    logo: '/brand/tplum-logo-white.png',
    /** big centred logo: share of the image width (0 = none, only the faint tile below), and its opacity */
    size: 0,
    opacity: 0.35,
    /** subtle repeated diagonal tile so the mark can't be cropped out */
    tileSize: 0.16,
    tileOpacity: 0.1,
    tileAngleDeg: -30,
    /** soft shadow so the white mark also shows on bright photos */
    shadow: true,
  },

  images: {
    thumbEdge: 600,
    previewEdge: 2048,
    webEdge: 2560,
    jpegQuality: 0.82,
    accept: ['image/jpeg', 'image/png', 'image/webp'],
  },

  upload: { concurrency: 3, retries: 3, batch: 25 },

  /** watermarked previews are deleted this many days after they're sent (keep in sync with the Edge Function) */
  purgeDays: 30,

  /** "Download all" builds zips in the browser in parts of this size */
  zipPart: { maxFiles: 100, maxBytes: 2 * 1024 ** 3 },
}

export type GalleryConfig = typeof galleryConfig

/** $12,500 */
export const money = (n: number | string | null | undefined) => `${galleryConfig.currency}${Number(n ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 2 })}`
/** the dashboard page for one booking's galleries */
export const managerHref = (bookingId: string) => `#galleries/${bookingId}`
