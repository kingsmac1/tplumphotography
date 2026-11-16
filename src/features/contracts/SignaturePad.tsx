import { useEffect, useRef, useState } from "react";

/** Draw-your-signature box (mouse, finger or stylus). Calls onChange with a PNG data URL, or "" when cleared. */
export default function SignaturePad({ onChange, height = 160 }: { onChange: (png: string) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = height * dpr;
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    };
    fit();
  }, [height]);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; last.current = null; if (!empty) onChange(ref.current!.toDataURL("image/png")); };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(""); };

  return (
    <div>
      <canvas ref={ref} style={{ width: "100%", height, touchAction: "none", background: "#fff", border: "1px solid #bbb", cursor: "crosshair", display: "block" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Signature pad: draw your signature" role="img" />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6, color: "#666" }}>
        <span>{empty ? "Sign above with your mouse or finger" : "Signature captured"}</span>
        <button type="button" onClick={clear} style={{ textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}>Clear</button>
      </div>
    </div>
  );
}

// The contract renderer now lives in ContractPaper.tsx (kept exported here for older imports).
export { ContractText } from "./ContractPaper";

/** Fills {{placeholders}} in a template. Unknown ones stay visible so nothing is silently dropped. */
export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (values[k] !== undefined && values[k] !== "" ? values[k] : m));
}
