export type WeddingPackage = {
  id: string;
  name: string;
  tagline: string;
  includes: string[];
  oneEvent: number;
  twoEvents?: number;
  singlePrice?: number;
  featured?: boolean;
  /** Which studio location this price applies to (uyo, lagos or abuja). */
  location?: string;
};

export type WeddingExtra = { name: string; price: number; location?: string };

export const DEFAULT_WEDDING_PACKAGES: WeddingPackage[] = [
  {
    id: "pearl",
    name: "Pearl",
    tagline: "Essential photography coverage",
    includes: [
      "Photography (One photographer)",
      "30 edited images (60 for a two-day event)",
      "Online gallery",
      "Event photos on flash drive",
      "Complimentary pre-wedding (2 outfits · 7 edited photos)",
    ],
    oneEvent: 600000,
    twoEvents: 800000,
  },
  {
    id: "sapphire",
    name: "Sapphire",
    tagline: "Photo + video coverage",
    includes: [
      "Photography (One photographer)",
      "Videography (One videographer)",
      "30 edited images (60 for a two-day event)",
      "Event photos on flash drive",
      "Trailer video and full-length video",
      "Online gallery",
      "Complimentary pre-wedding (2 outfits · 7 photos)",
    ],
    oneEvent: 800000,
    twoEvents: 1000000,
  },
  {
    id: "emerald",
    name: "Emerald",
    tagline: "Premium double-photographer package",
    featured: true,
    includes: [
      "Photography (Two photographers)",
      "40 edited photos (80 for a two-day event)",
      "One medium photo album (10×24″)",
      "Medium wall frame 16×20″ (two frames for two-day event)",
      "Event photos on flash drive",
      "Online gallery",
      "Complimentary pre-wedding (2 outfits · 7 photos)",
    ],
    oneEvent: 1000000,
    twoEvents: 1200000,
  },
  {
    id: "diamond",
    name: "Diamond",
    tagline: "The full DMI signature experience",
    includes: [
      "Photography (Two photographers)",
      "Videography (Two videographers)",
      "40 edited photos (80 for a two-day event)",
      "Trailer video and full-length video",
      "One medium photo album (10×24″)",
      "Medium wall frame 16×20″ (two frames for two-day event)",
      "Event photos on flash drive",
      "Online gallery",
      "Complimentary pre-wedding (2 outfits · 7 photos)",
    ],
    oneEvent: 1200000,
    twoEvents: 1400000,
  },
  {
    id: "court",
    name: "Court Marriage",
    tagline: "Intimate courthouse coverage",
    includes: ["Photography (One photographer)", "20 edited images", "Online gallery"],
    oneEvent: 100000,
    singlePrice: 100000,
  },
  {
    id: "introduction",
    name: "Introduction",
    tagline: "Traditional intro ceremony",
    includes: ["Photography (One photographer)", "20 edited images", "Online gallery"],
    oneEvent: 100000,
    singlePrice: 100000,
  },
];

export const DEFAULT_WEDDING_EXTRAS: WeddingExtra[] = [
  { name: "Drone (aerial footage)", price: 50000 },
  { name: "Extra photographer per event", price: 100000 },
  { name: "Extra videographer per event", price: 100000 },
  { name: "Backdrops", price: 70000 },
  { name: "Content creator", price: 150000 },
];
