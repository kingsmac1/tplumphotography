import type { PageKey } from "@/cms/types";

/**
 * The editor hands its unsaved content to the preview page (an iframe in the editor, or a separate tab) through
 * localStorage. Both are on the same address, so the preview's "storage" event fires on every change.
 * Nothing here is sent anywhere or shown to visitors.
 */
export const PREVIEW_KEY = "tplum-cms-preview";
export type PreviewPayload = { page: PageKey; site: unknown; content: unknown; at: number };

export function sendPreview(p: Omit<PreviewPayload, "at">) {
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ ...p, at: Date.now() })); } catch { /* blocked storage: preview shows the last state */ }
}

export function readPreview(): PreviewPayload | null {
  try { return JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "null") as PreviewPayload | null; } catch { return null; }
}
