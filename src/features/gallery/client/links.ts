/** A gallery's address; with its private key it opens without signing in. */
export const galleryHref = (id: string, key?: string | null) => `/client-gallery/?id=${encodeURIComponent(id)}${key ? `&k=${encodeURIComponent(key)}` : ''}`
