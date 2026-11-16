import { Fragment, type ReactNode } from "react";
import "./contract.css";

/**
 * The contract as a printed document: Tplum letterhead, title, the client details, then the contract text.
 * Used by the client's signing page and by the dashboard preview, so both look exactly alike.
 *
 * Contract text format (plain text, typed in Dashboard → Contracts → Templates):
 *   Couple:: Precious & Emmanuel     a "Label:: value" block becomes the details panel under the title
 *   ## Payment and Retainer          section heading
 *   ### Total fee                    sub-heading
 *   - Wedding coverage: $2,500       bullet point (• works too)
 *   **bold**                         bold words
 *   A blank line starts a new paragraph. A short "1. Title" line is still read as a heading (older contracts).
 *   A {{placeholder}} that was never filled is highlighted so it can't slip through unnoticed.
 */

const BULLET = /^[-•]\s+/;
const DETAIL = /^([^:\n]{1,40})::\s*(.*)$/;

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\{\{\s*\w+\s*\}\})/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\{\{\s*\w+\s*\}\}$/.test(part)) return <mark key={i} className="ct-missing" title="Not filled in yet">{part}</mark>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block = { kind: "h2" | "h3" | "p"; text: string } | { kind: "ul"; items: string[] } | { kind: "details"; rows: [string, string][] };

export function parseContract(body: string): Block[] {
  const out: Block[] = [];
  for (const chunk of (body ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => DETAIL.test(l.trim()))) {
      out.push({ kind: "details", rows: lines.map((l) => { const m = DETAIL.exec(l.trim())!; return [m[1].trim(), m[2].trim()]; }) });
      continue;
    }
    if (lines.length === 1 && /^\d+\.\s/.test(lines[0].trim()) && lines[0].length < 80) {
      out.push({ kind: "h3", text: lines[0].trim() });
      continue;
    }
    let para: string[] = [];
    const flush = () => { if (para.length) out.push({ kind: "p", text: para.join("\n") }); para = []; };
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("## ")) { flush(); out.push({ kind: "h2", text: line.slice(3).trim() }); }
      else if (line.startsWith("### ")) { flush(); out.push({ kind: "h3", text: line.slice(4).trim() }); }
      else if (BULLET.test(line)) {
        flush();
        const last = out[out.length - 1];
        const item = line.replace(BULLET, "");
        if (last && last.kind === "ul") last.items.push(item); else out.push({ kind: "ul", items: [item] });
      } else para.push(line);
    }
    flush();
  }
  // bullets split by a blank line still read as one list
  return out.reduce<Block[]>((acc, b) => {
    const prev = acc[acc.length - 1];
    if (b.kind === "ul" && prev?.kind === "ul") prev.items.push(...b.items); else acc.push(b);
    return acc;
  }, []);
}

/** The contract text alone (no letterhead). */
export function ContractText({ body }: { body: string }) {
  return (
    <div className="ct-body">
      {parseContract(body).map((b, i) => {
        if (b.kind === "details") {
          return (
            <dl key={i} className="ct-details">
              {b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{inline(v)}</dd></div>)}
            </dl>
          );
        }
        if (b.kind === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        if (b.kind === "h2") return <h2 key={i}>{inline(b.text)}</h2>;
        if (b.kind === "h3") return <h3 key={i}>{inline(b.text)}</h3>;
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}

export function Letterhead() {
  return (
    <header className="ct-letterhead">
      <img src="/brand/tplum-logo-dark.png" alt="Tplum Photography" width={150} height={83} />
      <p className="ct-tagline">...capturing moments beautifully.</p>
      <p className="ct-contact">
        <a href="https://tplumphotography.com">tplumphotography.com</a>
        <span aria-hidden="true" className="ct-sep" />
        <a href="tel:+14034935511">+1 403 493 5511</a>
      </p>
    </header>
  );
}

/** The full sheet. `children` goes at the foot of the paper (the signature blocks). */
export function ContractPaper({ title, number, body, children }: { title: string; number?: string; body: string; children?: ReactNode }) {
  return (
    <article className="ct-paper">
      <Letterhead />
      <div className="ct-titleblock">
        <h1>{title}</h1>
        {number && <p className="ct-number">Contract {number}</p>}
      </div>
      <ContractText body={body} />
      {children}
    </article>
  );
}

/** Two signature blocks side by side, as on the paper contract. */
export function SignatureBlocks({ client, studio }: { client: { name?: string | null; date?: string | null; image?: string | null }; studio: { name?: string | null; date?: string | null; image?: string | null } }) {
  const one = (label: string, s: { name?: string | null; date?: string | null; image?: string | null }) => (
    <div className="ct-sign">
      <div className="ct-sign-line">{s.image ? <img src={s.image} alt={`Signature: ${s.name ?? label}`} /> : null}</div>
      <p className="ct-sign-label">{label}</p>
      <p className="ct-sign-meta">{s.name || "Name"}<br />{s.date ? `Dated ${s.date}` : "Date"}</p>
    </div>
  );
  return (
    <section className="ct-signatures" aria-label="Signatures">
      {one("Tplum Photography", studio)}
      {one("Client", client)}
    </section>
  );
}
