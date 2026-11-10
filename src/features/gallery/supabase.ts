/** The DMI Supabase client, plus whether the site is connected (both env vars set). */
import { supabase as client } from '@/lib/supabaseClient'

export const configured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
export const supabase = client
