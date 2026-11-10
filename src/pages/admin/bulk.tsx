import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Tracks which row ids are ticked in an admin table. */
export function useRowSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Tick or untick a whole list of ids at once (used by "select all"). */
  const setMany = (list: string[], on: boolean) =>
    setIds((prev) => {
      const next = new Set(prev);
      list.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const clear = () => setIds(new Set());

  return { ids, toggle, setMany, clear };
}

interface BulkActionBarProps {
  count: number;
  noun: string;
  message?: string;
  onClear: () => void;
  children: ReactNode;
}

/** Floating bar shown while one or more rows are ticked. */
export const BulkActionBar = ({ count, noun, message, onClear, children }: BulkActionBarProps) => {
  if (count === 0) return null;
  return (
    <div className="fixed z-40 bottom-20 md:bottom-6 left-3 right-16 md:left-72 md:right-20 mx-auto max-w-3xl bg-neutral-950 text-white shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-body font-bold mr-2">
        {count} {noun}{count === 1 ? "" : "s"} selected
      </span>
      {children}
      {message && <span className="text-xs font-body text-white/70 basis-full sm:basis-auto">{message}</span>}
      <button onClick={onClear} className="ml-auto inline-flex items-center gap-1 text-xs font-body text-white/70 hover:text-white" aria-label="Clear selection">
        <X size={14} /> Clear
      </button>
    </div>
  );
};

export const BulkButton = ({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-body font-bold tracking-wider border transition-colors ${
      danger ? "border-red-400 text-red-300 hover:bg-red-500 hover:text-white" : "border-white/40 hover:bg-white hover:text-black"
    }`}
  >
    {children}
  </button>
);

/**
 * The tick-box and S/N columns stay pinned to the left when the table scrolls sideways;
 * the column titles stay pinned to the top when it scrolls vertically.
 */
const CHECK_W = "w-10 min-w-[2.5rem] max-w-[2.5rem]";
const SN_W = "w-14 min-w-[3.5rem] max-w-[3.5rem]";
export const stickyCheckHead = `${CHECK_W} sticky left-0 top-0 z-30 bg-background shadow-[0_1px_0_hsl(var(--border))]`;
export const stickySnHead = `${SN_W} sticky left-10 top-0 z-30 bg-background shadow-[1px_0_0_hsl(var(--border)),0_1px_0_hsl(var(--border))]`;
export const stickyCheckCell = (selected: boolean) =>
  `${CHECK_W} sticky left-0 z-10 ${selected ? "bg-muted" : "bg-background"}`;
export const stickySnCell = (selected: boolean) =>
  `${SN_W} sticky left-10 z-10 text-xs text-muted-foreground shadow-[1px_0_0_hsl(var(--border))] ${selected ? "bg-muted" : "bg-background"}`;
