import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { callFunction } from "@/lib/functions";
import SignaturePad from "./SignaturePad";
import { ContractPaper, SignatureBlocks } from "./ContractPaper";

type Contract = {
  number: string; title: string; client_name: string; body: string; status: string;
  signed_at: string | null; signer_name: string | null; signature_data: string | null;
  studio_signed_at: string | null; studio_signer_name: string | null; studio_signature_data: string | null;
};

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long", timeStyle: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" });

/** /contract/?t=<token>: the client reads the contract on Tplum's letterhead, types their name, draws a signature and agrees. */
export default function PublicContract({ token }: { token: string }) {
  const [c, setC] = useState<Contract | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [sig, setSig] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!isSupabaseConfigured || !/^[0-9a-f]{40,80}$/.test(token)) { setC(null); return; }
    supabase.rpc("contract_by_token", { p_token: token }).then(({ data, error }) => setC(error ? null : (data as Contract | null)));
  };
  useEffect(load, [token]);

  const sign = async () => {
    setErr("");
    if (name.trim().length < 2) return setErr("Type your full name.");
    if (!sig) return setErr("Draw your signature in the box.");
    if (!agree) return setErr("Tick the box to agree to the contract.");
    setBusy(true);
    const r = await callFunction("contract-sign", { token, name: name.trim(), signature: sig, agree, body_hash: await sha256(c!.body) });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (c === undefined) return <div className="min-h-[60vh] grid place-items-center text-sm">Loading your contract…</div>;
  if (!c) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl mb-3">Contract not found</h1>
          <p className="text-sm max-w-md">This link may be incomplete or the contract was withdrawn. Check the email you received, or contact us at info@tplumphotography.com.</p>
        </div>
      </div>
    );
  }
  const signed = c.status === "signed" || c.status === "countersigned";
  return (
    <div className="ct-page px-4 py-10 md:py-16" style={{ background: "#f1ede6" }}>
      <div className="max-w-[820px] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm" style={{ color: "#5b564e" }}>
          {signed ? `Signed by ${c.signer_name} on ${when(c.signed_at!)} (Mountain Time).` : `Prepared for ${c.client_name}. Read it through, then sign at the bottom.`}
        </p>
        {signed && <button type="button" onClick={() => window.print()} className="border border-black px-5 py-2.5 text-xs tracking-widest hover:bg-black hover:text-white transition">PRINT OR SAVE AS PDF</button>}
      </div>

      <ContractPaper title={c.title} number={c.number} body={c.body}>
        {signed && (
          <SignatureBlocks
            client={{ name: c.signer_name, date: c.signed_at ? day(c.signed_at) : null, image: c.signature_data }}
            studio={{ name: c.studio_signer_name, date: c.studio_signed_at ? day(c.studio_signed_at) : null, image: c.studio_signature_data }}
          />
        )}
      </ContractPaper>

      {!signed && (
        <section className="max-w-[820px] mx-auto mt-8 bg-white p-6 md:p-10 space-y-5 print:hidden" aria-labelledby="sign-heading">
          <h2 id="sign-heading" className="font-display text-3xl md:text-4xl">Sign this contract</h2>
          <label className="block">
            <span className="block text-sm mb-1.5">Your full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full border border-neutral-400 px-3 py-3 focus:border-black outline-none" />
          </label>
          <div>
            <span className="block text-sm mb-1.5">Your signature</span>
            <SignaturePad onChange={setSig} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>I have read and agree to this contract, and I understand that typing my name and drawing my signature here is a legal electronic signature.</span>
          </label>
          {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
          <button type="button" onClick={sign} disabled={busy} className="bg-black text-white px-8 py-4 text-xs tracking-widest hover:bg-neutral-800 transition disabled:opacity-50">{busy ? "SIGNING…" : "SIGN CONTRACT"}</button>
        </section>
      )}
    </div>
  );
}
