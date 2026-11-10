import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { callFunction } from "@/lib/functions";
import SignaturePad, { ContractText } from "./SignaturePad";

type Contract = {
  number: string; title: string; client_name: string; body: string; status: string;
  signed_at: string | null; signer_name: string | null; signature_data: string | null;
  studio_signed_at: string | null; studio_signer_name: string | null; studio_signature_data: string | null;
};

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long", timeStyle: "short" });

/** /contract/<token>/: the client reads the contract, types their name, draws a signature and agrees. Signed copies stay viewable. */
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
    if (name.trim().length < 2) return setErr("Please type your full name.");
    if (!sig) return setErr("Please draw your signature in the box.");
    if (!agree) return setErr("Please tick the box to agree to the contract.");
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
          <p className="text-sm max-w-md">This link may be incomplete or the contract was withdrawn. Please check the email you received, or contact us at info@tplumphotography.com.</p>
        </div>
      </div>
    );
  }
  const signed = c.status === "signed" || c.status === "countersigned";
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
      <p className="text-xs uppercase tracking-widest text-neutral-500">Contract {c.number}</p>
      <h1 className="font-display text-4xl md:text-5xl mt-1 mb-2">{c.title}</h1>
      <p className="text-sm mb-8">{signed ? `Signed by ${c.signer_name} on ${when(c.signed_at!)} (Mountain Time).` : `Prepared for ${c.client_name}. Please read it through, then sign at the bottom.`}</p>
      {signed && <button type="button" onClick={() => window.print()} className="mb-8 border border-black px-5 py-3 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition print:hidden">Print or save as PDF</button>}
      <div className="border border-neutral-300 p-6 md:p-10 bg-white"><ContractText body={c.body} /></div>

      {signed ? (
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div className="border border-neutral-300 p-4">
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Client</p>
            {c.signature_data && <img src={c.signature_data} alt={`Signature of ${c.signer_name}`} className="h-20 object-contain" />}
            <p className="text-sm mt-2">{c.signer_name}<br />{when(c.signed_at!)}</p>
          </div>
          <div className="border border-neutral-300 p-4">
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Tplum Photography</p>
            {c.studio_signature_data ? <img src={c.studio_signature_data} alt="Studio signature" className="h-20 object-contain" /> : <p className="text-sm text-neutral-500">Countersignature pending</p>}
            {c.studio_signed_at && <p className="text-sm mt-2">{c.studio_signer_name}<br />{when(c.studio_signed_at)}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-10 border border-neutral-300 p-6 space-y-5 print:hidden">
          <h2 className="font-display text-3xl">Sign</h2>
          <label className="block">
            <span className="block text-sm mb-1.5">Your full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full border border-neutral-400 px-3 py-2.5" />
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
          <button type="button" onClick={sign} disabled={busy} className="bg-black text-white px-6 py-3 text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50">{busy ? "Signing…" : "Sign contract"}</button>
        </div>
      )}
    </div>
  );
}
