export type StudioSpaceOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
};

export type StudioSpaceExtra = {
  id: string;
  name: string;
  description: string;
  price: number;
  max_qty: number;
  /** Costs the same as whichever space the client picked (used for "Extra 30 Minutes"). */
  followsSpace?: boolean;
};

// The studio's current rate card. Editable later from the dashboard (Prices -> Studio Space);
// these are only the starting values used until an admin loads them there.
export const DEFAULT_STUDIO_SPACE_PRICES: StudioSpaceOption[] = [
  { id: "backdrop-no-ac", name: "Studio Backdrop (without AC)", description: "30 minutes", price: 8000, duration_minutes: 30 },
  { id: "backdrop-ac", name: "Studio Backdrop (with AC)", description: "30 minutes", price: 10000, duration_minutes: 30 },
  { id: "content-space", name: "Content Space", description: "30 minutes", price: 20000, duration_minutes: 30 },
];

export const DEFAULT_STUDIO_SPACE_EXTRAS: StudioSpaceExtra[] = [
  { id: "extra-time", name: "Extra 30 Minutes", description: "Same rate as your chosen space, per additional 30 minutes", price: 0, max_qty: 6, followsSpace: true },
  { id: "props", name: "Props", description: "Per item", price: 5000, max_qty: 10 },
  { id: "flower-pots", name: "Flower Pots", description: "Per item", price: 5000, max_qty: 10 },
  { id: "chairs", name: "Chairs", description: "Per item", price: 5000, max_qty: 10 },
];
