import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

/** False until the public Supabase values are filled in .env (Phase B). Pages then use their built-in defaults. */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/**
 * What kind of email link opened this page, read before the client below turns the link into a session.
 * Supabase's standard emails (password reset, invite) arrive as …/account/#access_token=…&type=recovery|invite.
 */
export const authLinkType: string | null =
  typeof window !== "undefined" ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") : null;

// A placeholder URL keeps the client constructible before Phase B; nothing is called while unconfigured.
export const supabase = createClient(supabaseUrl || "https://not-configured.supabase.co", supabaseAnonKey || "not-configured", {
  auth: { persistSession: typeof window !== "undefined", autoRefreshToken: typeof window !== "undefined" },
});
