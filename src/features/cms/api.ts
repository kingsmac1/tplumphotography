import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { mergeContent, SEED, type DocKey } from "@/cms/types";

/**
 * Reads and writes CMS documents (supabase/migrations/..._cms.sql).
 * Before Supabase is connected (Phase A), everything is kept in this browser's localStorage ("demo mode") so the
 * editor, preview, publish and restore can all be tried; nothing reaches the live site in that mode.
 */
export const demoMode = !isSupabaseConfigured;

export type Doc = { draft: unknown; published: unknown; publishedAt: string | null; draftSavedAt: string | null };
export type Revision = { id: string; created_at: string; note: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const full = (key: DocKey, v: unknown) => clone(mergeContent(SEED[key], v));

/* ---------- demo store ---------- */
type DemoDoc = { draft?: unknown; published?: unknown; publishedAt?: string | null; draftSavedAt?: string | null; revisions?: (Revision & { content: unknown })[] };
const demoKey = (k: DocKey) => `tplum-cms-demo:${k}`;
const demoGet = (k: DocKey): DemoDoc => {
  try { return JSON.parse(localStorage.getItem(demoKey(k)) ?? "{}") as DemoDoc; } catch { return {}; }
};
const demoSet = (k: DocKey, d: DemoDoc) => {
  try { localStorage.setItem(demoKey(k), JSON.stringify(d)); } catch { /* storage full or blocked: demo only */ }
};

export async function loadDoc(key: DocKey): Promise<Doc> {
  if (demoMode) {
    const d = demoGet(key);
    return { draft: full(key, d.draft ?? d.published), published: full(key, d.published), publishedAt: d.publishedAt ?? null, draftSavedAt: d.draftSavedAt ?? null };
  }
  const { data, error } = await supabase.from("cms_documents").select("draft, published, published_at, draft_updated_at").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  // No row yet: the page still shows the WordPress seed, so draft and live are both the seed.
  const published = data?.published && Object.keys(data.published).length ? data.published : undefined;
  const draft = data?.draft && Object.keys(data.draft).length ? data.draft : published;
  return { draft: full(key, draft), published: full(key, published), publishedAt: data?.published_at ?? null, draftSavedAt: data ? data.draft_updated_at : null };
}

export async function saveDraft(key: DocKey, content: unknown): Promise<string> {
  if (demoMode) {
    const at = new Date().toISOString();
    demoSet(key, { ...demoGet(key), draft: content, draftSavedAt: at });
    return at;
  }
  const { data, error } = await supabase.rpc("cms_save_draft", { p_key: key, p_content: content });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function publish(key: DocKey, content: unknown, note: string): Promise<string> {
  await saveDraft(key, content);
  if (demoMode) {
    const d = demoGet(key);
    const at = new Date().toISOString();
    const revisions = [{ id: crypto.randomUUID(), created_at: at, note, content }, ...(d.revisions ?? [])].slice(0, 50);
    demoSet(key, { ...d, published: content, publishedAt: at, revisions });
    return at;
  }
  const { data, error } = await supabase.rpc("cms_publish", { p_key: key, p_note: note });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Throws away unpublished changes: the draft goes back to what is live. */
export async function discardDraft(key: DocKey): Promise<void> {
  if (demoMode) {
    const d = demoGet(key);
    demoSet(key, { ...d, draft: d.published, draftSavedAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.rpc("cms_discard_draft", { p_key: key });
  if (error) throw new Error(error.message);
}

export async function listRevisions(key: DocKey): Promise<Revision[]> {
  if (demoMode) return (demoGet(key).revisions ?? []).map(({ id, created_at, note }) => ({ id, created_at, note }));
  const { data, error } = await supabase.from("cms_revisions").select("id, created_at, note").eq("key", key).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Puts an earlier published version back into the draft (preview it, then publish). */
export async function restoreRevision(key: DocKey, id: string): Promise<void> {
  if (demoMode) {
    const d = demoGet(key);
    const r = d.revisions?.find((x) => x.id === id);
    if (!r) throw new Error("Version not found.");
    demoSet(key, { ...d, draft: r.content, draftSavedAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.rpc("cms_restore", { p_revision: id });
  if (error) throw new Error(error.message);
}

/** Back to the original WordPress content (into the draft only). */
export const seedFor = (key: DocKey) => clone(SEED[key]);
