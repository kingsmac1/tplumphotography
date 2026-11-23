import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { demoMode, rebuildSite } from "./api";

/**
 * Dashboard → Website → Website design: which design visitors see (classic or modern) and whether they may switch
 * between the two with the corner switch. Saved in business_settings; the site is rebuilt so the choice is baked into
 * every page (about two minutes).
 */
type Design = "classic" | "modern";
const CHOICES: { id: Design; title: string; text: string }[] = [
  { id: "classic", title: "Classic", text: "The original Tplum website: full-width photographs, centred headings, square edges." },
  { id: "modern", title: "Modern", text: "Rounded photo cards and bento grids, big headlines, pill buttons, a floating header and a dark footer." },
];

export default function DesignPanel() {
  const [saved, setSaved] = useState<{ site_design: Design; allow_design_switch: boolean } | null>(null);
  const [design, setDesign] = useState<Design>("classic");
  const [allow, setAllow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    if (demoMode) return;
    supabase.from("business_settings").select("site_design, allow_design_switch").eq("id", 1).maybeSingle().then(({ data }) => {
      const d = { site_design: (data?.site_design === "modern" ? "modern" : "classic") as Design, allow_design_switch: data?.allow_design_switch !== false };
      setSaved(d); setDesign(d.site_design); setAllow(d.allow_design_switch);
    });
  }, []);
  const changed = !!saved && (saved.site_design !== design || saved.allow_design_switch !== allow);
  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("business_settings").update({ site_design: design, allow_design_switch: allow }).eq("id", 1);
    if (error) { setBusy(false); setMsg({ ok: false, t: error.message }); return; }
    const problem = await rebuildSite();
    setBusy(false);
    setSaved({ site_design: design, allow_design_switch: allow });
    setMsg(problem ? { ok: false, t: `Saved, but the site couldn't be rebuilt automatically (${problem}). Press Publish on any page to rebuild it.` } : { ok: true, t: "Saved. The live site updates in about two minutes." });
  };
  return (
    <section className="border border-border p-5 md:p-6 space-y-5">
      <div>
        <h2 className="font-display text-2xl">Website design</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">The website has two designs with the same pages and content. Choose the one visitors see. Your words and photos are shared, so editing a page changes it in both.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Design visitors see">
        {CHOICES.map((c) => (
          <label key={c.id} className={`block cursor-pointer border p-4 transition ${design === c.id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/50"}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="site-design" value={c.id} checked={design === c.id} onChange={() => setDesign(c.id)} />
              <span className="font-display text-xl">{c.title}</span>
              <a href={`/?design=${c.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto inline-flex items-center gap-1 text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground">
                Preview <ExternalLink size={12} />
              </a>
            </span>
            <span className="block text-sm text-muted-foreground mt-2 pl-7">{c.text}</span>
          </label>
        ))}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
        <span>Let visitors switch between the two designs<span className="block text-xs text-muted-foreground mt-0.5">Shows a small Classic / Modern switch in the bottom-left corner of every page. Their choice is remembered in their browser. Untick it to show everyone the design above.</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={!changed || busy || demoMode} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm disabled:opacity-40">
          {busy && <Loader2 size={15} className="animate-spin" />} Save design
        </button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.t}</p>}
        {demoMode && <p className="text-xs text-muted-foreground">Connect the database to change the design.</p>}
      </div>
    </section>
  );
}
