import { supabase } from "@/lib/supabaseClient";

export type EmailSection = { id: string; name: string; blocks: Record<string, unknown>[]; created_at: string };

export async function listEmailSections(): Promise<EmailSection[]> {
  const { data, error } = await supabase.from("email_sections").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as EmailSection[]) || [];
}

export async function createEmailSection(name: string, blocks: Record<string, unknown>[]) {
  const { error } = await supabase.from("email_sections").insert({ name, blocks });
  if (error) throw new Error(error.message);
}

export async function removeEmailSection(id: string) {
  const { data, error } = await supabase.from("email_sections").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Nothing was deleted. Make sure your account is an admin in the staff table.");
}
