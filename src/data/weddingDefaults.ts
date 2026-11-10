/** SAMPLE wedding packages (CAD). Seeded with sample = true ("Sample: edit me" in the dashboard only). */
export type WeddingPackage = {
  id: string;
  name: string;
  tagline: string;
  includes: string[];
  /** price for one day of coverage */
  oneEvent: number;
  /** price for two days (e.g. traditional + white wedding); empty = single price */
  twoEvents?: number;
  singlePrice?: number;
  featured?: boolean;
  sample?: boolean;
};

export type WeddingExtra = { name: string; price: number; sample?: boolean };

export const DEFAULT_WEDDING_PACKAGES: WeddingPackage[] = [
  {
    id: "intimate", name: "Intimate", tagline: "Elopements, courthouse and small celebrations", sample: true,
    includes: ["Up to 4 hours of coverage", "One photographer", "250+ edited images", "Online gallery with download", "Sneak peek within one week"],
    oneEvent: 1800,
  },
  {
    id: "classic", name: "Classic", tagline: "Full-day storytelling", sample: true,
    includes: ["Up to 8 hours of coverage", "One photographer + assistant", "500+ edited images", "Online gallery with download", "Sneak peek within one week", "Planning call and wedding guide"],
    oneEvent: 3200, twoEvents: 5400,
  },
  {
    id: "signature", name: "Signature", tagline: "Our most-booked wedding collection", featured: true, sample: true,
    includes: ["Up to 12 hours of coverage", "Two photographers + assistant", "800–1,200 edited images", "Complimentary engagement session", "Online gallery with download", "Sneak peek within one week"],
    oneEvent: 4800, twoEvents: 7800,
  },
  {
    id: "luxury", name: "Luxury", tagline: "Photo, film and heirloom album", sample: true,
    includes: ["Up to 12 hours of coverage", "Two photographers + videographer", "1,000–1,500 edited images", "Highlight film", "Engagement session", "10×10″ heirloom album"],
    oneEvent: 7200, twoEvents: 11000,
  },
];

export const DEFAULT_WEDDING_EXTRAS: WeddingExtra[] = [
  { name: "Engagement Session", price: 450, sample: true },
  { name: "Extra Hour of Coverage", price: 300, sample: true },
  { name: "Second Photographer (per hour)", price: 125, sample: true },
  { name: "Heirloom Album 10×10″", price: 900, sample: true },
  { name: "Highlight Film", price: 1500, sample: true },
  { name: "Fine Art Wall Frame 16×20″", price: 350, sample: true },
];
