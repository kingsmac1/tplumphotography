/**
 * DMI's galleries could be paused by Emkay Digitals' platform billing. Tplum's galleries are not part of that
 * billing (see MIGRATION-NOTES.md, "Decisions"), so these checks always allow. Kept as no-ops so the gallery
 * functions stay identical to DMI's and billing can be plugged back in later without touching them.
 */
export const billingConfigured = () => false
export async function getBilling(_force = false) { return { billing: null, fresh: true } }
export async function reportUsage(_bytes: number) {}
export async function reportPurgeDone(_objects: number, _bytes: number) {}
export async function requireGalleryEnabled() {}
export async function requireUploadsAllowed() {}
