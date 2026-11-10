/** Calls a Supabase Edge Function from the public site (no login). Returns { ok, data | error }. */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backendReady = () => !!(URL_ && ANON);

export async function callFunction<T = unknown>(name: string, body: unknown, accessToken?: string): Promise<{ ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> }> {
  if (!URL_ || !ANON) return { ok: false, error: "The booking system is not connected yet. Please email info@tplumphotography.com." };
  try {
    const res = await fetch(`${URL_}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${accessToken ?? ANON}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) return { ok: false, error: json.error ?? `Something went wrong (${res.status}). Please try again.`, fields: json.fields };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
  }
}
