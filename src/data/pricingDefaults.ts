export type PriceRow = {
  id: string;
  location: string;
  setting: string;
  service_id: string;
  name: string;
  description: string;
  price: number;
  pricing_mode: string;
  sort_order: number;
  active: boolean;
};

export type ExtraRow = {
  id: string;
  location: string;
  name: string;
  description: string;
  price: number;
  max_qty: number | null;
  follows_package: boolean;
  sort_order: number;
  active: boolean;
};

export const BOOKING_LOCATIONS = [
  { id: "uyo", name: "UYO" },
  { id: "lagos", name: "LAGOS" },
  { id: "abuja", name: "ABUJA" },
];

const services = [
  { id: "individual", name: "Individual" },
  { id: "couple", name: "Couple" },
  { id: "group", name: "Group/Family" },
];

const uyoPrices = { indoor: [50000, 60000, 70000], outdoor: [70000, 80000, 90000] };
const metroPrices = { indoor: [100000, 120000, 150000], outdoor: [150000, 170000, 200000] };

export const DEFAULT_BOOKING_PRICES: PriceRow[] = BOOKING_LOCATIONS.flatMap((loc) =>
  (["indoor", "outdoor"] as const).flatMap((setting) =>
    services.map((svc, i) => ({
      id: `${loc.id}-${setting}-${svc.id}`,
      location: loc.id,
      setting,
      service_id: svc.id,
      name: svc.name,
      description: loc.id === "uyo" ? "1 outfit · 3 edited images" : "Session rate",
      price: (loc.id === "uyo" ? uyoPrices : metroPrices)[setting][i],
      pricing_mode: "bundle",
      sort_order: i + 1,
      active: true,
    })),
  ),
);

const extrasFor = (loc: string, unedited: number) => [
  { name: "30-second Reel", description: "Short-form video edit", price: 40000, max_qty: null, follows_package: false },
  { name: "Extra Edited Picture", description: "Per additional retouched photo", price: 10000, max_qty: 20, follows_package: false },
  { name: "Extra Outfit", description: "Per additional outfit · same price as your package", price: 0, max_qty: 5, follows_package: true },
  { name: "All Unedited Photos", description: loc === "uyo" ? "Full set of raw images" : "Full set of unedited photos", price: unedited, max_qty: null, follows_package: false },
];

export const DEFAULT_BOOKING_EXTRAS: ExtraRow[] = BOOKING_LOCATIONS.flatMap((loc) =>
  extrasFor(loc.id, loc.id === "uyo" ? 15000 : 20000).map((e, i) => ({
    ...e,
    id: `${loc.id}-extra-${i}`,
    location: loc.id,
    sort_order: i + 1,
    active: true,
  })),
);
