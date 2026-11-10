import { X, Printer, Share2, Pencil, FileText } from "lucide-react";
import { formatMoney } from "./formOptions";
import { useBodyScrollLock } from "./useBodyScrollLock";

interface DetailModalProps {
  title: string;
  record: Record<string, unknown>;
  fields: { key: string; label: string; render?: (v: unknown) => string }[];
  onClose: () => void;
  onEdit?: () => void;
  /** link to make (or reopen) this booking's invoice */
  invoiceHref?: string;
  /** extra content under the fields */
  children?: React.ReactNode;
  /** content above the fields (e.g. the delivery deadline) */
  top?: React.ReactNode;
}

export default function DetailModal({ title, record, fields, onClose, onEdit, invoiceHref, children, top }: DetailModalProps) {
  useBodyScrollLock(true);
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = fields.map((f) => {
      const raw = record[f.key];
      const val = f.render ? f.render(raw) : String(raw ?? "—");
      return `<tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:600;background:#f7f7f7;">${f.label}</td><td style="padding:6px 12px;border:1px solid #ddd;">${val}</td></tr>`;
    }).join("");
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;padding:32px;}h1{margin-bottom:24px;}table{width:100%;border-collapse:collapse;font-size:14px;}</style></head><body><h1>${title}</h1><table>${rows}</table><script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  const handleShare = async () => {
    const text = fields
      .map((f) => `${f.label}: ${f.render ? f.render(record[f.key]) : String(record[f.key] ?? "—")}`)
      .join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${title}\n\n${text}`);
        alert("Copied to clipboard");
      } catch {
        /* clipboard failed */
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden" onClick={onClose}>
      <div
        className="bg-background border border-border max-w-2xl w-full max-h-[85vh] min-h-0 overflow-y-auto overscroll-contain"
        data-lenis-prevent
        style={{ scrollbarGutter: "stable" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {top}
          {fields.map((f) => {
            const raw = record[f.key];
            const val = f.render ? f.render(raw) : String(raw ?? "—");
            return (
              <div key={f.key} className="grid grid-cols-3 gap-4 border-b border-border pb-3">
                <div className="text-xs font-body font-bold tracking-widest text-muted-foreground">{f.label.toUpperCase()}</div>
                <div className="col-span-2 text-sm font-body break-words">{val || "—"}</div>
              </div>
            );
          })}
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-3 p-6 border-t border-border">
          {invoiceHref && (
            <a href={invoiceHref} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">
              <FileText size={16} /> Generate invoice
            </a>
          )}
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">
              <Pencil size={16} /> Edit
            </button>
          )}
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleShare} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}

export { formatMoney };