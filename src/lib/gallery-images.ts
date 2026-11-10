type GlobImportMeta = ImportMeta & {
  glob: (pattern: string, options: { eager: true; import: "default" }) => Record<string, string>;
};

const FOLDER_TO_SLUG: Record<string, string> = {
  portrait: "portrait",
  wedding: "wedding",
  headshot: "headshot",
  maternity: "maternity",
  graduation: "graduation",
  couple: "couple",
  "fine art": "fine-art",
  "fine-art": "fine-art",
  "fine_art": "fine-art",
  editorial: "editorial",
};

const normalizeFolder = (folder: string) =>
  folder
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const resolveSlugFromPath = (filePath: string): string | undefined => {
  const folders = filePath.split("/").slice(0, -1);

  // Resolve from nearest parent outward so nested subfolders still map to the owning category.
  for (let i = folders.length - 1; i >= 0; i -= 1) {
    const slug = FOLDER_TO_SLUG[normalizeFolder(folders[i] ?? "")];
    if (slug) return slug;
  }

  return undefined;
};

const rawGalleryImages = (import.meta as GlobImportMeta).glob("../../DMI Gallery Images/**/*.{jpg,JPG,jpeg,JPEG,png,PNG,webp,WEBP}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const galleryImagesBySlug: Record<string, string[]> = {};

Object.entries(rawGalleryImages).forEach(([filePath, imageUrl]) => {
  const slug = resolveSlugFromPath(filePath);

  if (!slug) {
    return;
  }

  if (!galleryImagesBySlug[slug]) {
    galleryImagesBySlug[slug] = [];
  }

  galleryImagesBySlug[slug].push(imageUrl);
});

export const coverBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(galleryImagesBySlug).map(([slug, images]) => [slug, images.slice().sort((a, b) => a.localeCompare(b))[0] ?? ""])
) as Record<string, string>;
