import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

/** False until the public Supabase values are filled in .env (Phase B). Pages then use their built-in defaults. */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// A placeholder URL keeps the client constructible before Phase B; nothing is called while unconfigured.
export const supabase = createClient(supabaseUrl || "https://not-configured.supabase.co", supabaseAnonKey || "not-configured", {
  auth: { persistSession: typeof window !== "undefined", autoRefreshToken: typeof window !== "undefined" },
});
