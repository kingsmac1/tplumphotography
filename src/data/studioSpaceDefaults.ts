export type StudioSpaceOption = { id: string; name: string; description: string; price: number; duration_minutes: number; sample?: boolean };
export type StudioSpaceExtra = { id: string; name: string; description: string; price: number; max_qty: number; followsSpace?: boolean; sample?: boolean };

/** SAMPLE studio rental rates (CAD), editable in Dashboard -> Prices -> Studio space. */
export const DEFAULT_STUDIO_SPACE_PRICES: StudioSpaceOption[] = [
  { id: "studio-basic", name: "Studio Space", description: "1 hour · backdrop and natural light", price: 60, duration_minutes: 60, sample: true },
  { id: "studio-lighting", name: "Studio + Lighting Kit", description: "1 hour · strobes, modifiers and backdrops", price: 90, duration_minutes: 60, sample: true },
  { id: "content-space", name: "Content Creator Space", description: "1 hour · styled set for video and reels", price: 75, duration_minutes: 60, sample: true },
];

export const DEFAULT_STUDIO_SPACE_EXTRAS: StudioSpaceExtra[] = [
  { id: "extra-time", name: "Extra Hour", description: "Same rate as your chosen space, per additional hour", price: 0, max_qty: 4, followsSpace: true, sample: true },
  { id: "backdrop", name: "Extra Backdrop Colour", description: "Per backdrop", price: 15, max_qty: 4, sample: true },
  { id: "props", name: "Props & Furniture", description: "Per item", price: 10, max_qty: 10, sample: true },
  { id: "assistant", name: "Studio Assistant", description: "Per hour", price: 40, max_qty: 4, sample: true },
];
