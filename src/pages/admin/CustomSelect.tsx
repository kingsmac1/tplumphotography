import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  id?: string;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  hasError = false,
  id,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  // Position the panel relative to the viewport using getBoundingClientRect.
  // The panel is rendered through a portal straight onto document.body (see
  // render below), so this is the only thing tying it visually to the trigger.
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const PANEL_MAX_H = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < PANEL_MAX_H && rect.top > spaceBelow;
    setPos({
      top: openAbove ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize, true);
    };
  }, [open]);

  // Close when clicking outside the trigger OR the (portalled) panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.querySelector<HTMLElement>("button")?.focus();
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div
      ref={triggerRef}
      className={`relative ${className}`}
      id={id}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full flex items-center justify-between border px-4 py-2 text-sm font-body outline-none transition-colors text-left cursor-pointer ${
          hasError
            ? "border-destructive bg-background"
            : open
            ? "border-foreground bg-background"
            : "border-border bg-background hover:border-foreground"
        }`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform shrink-0 ml-2 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && pos
        ? createPortal(
            <ul
              ref={panelRef}
              role="listbox"
              className="fixed z-[9999] list-none m-0 p-0 shadow-xl border border-border overflow-y-auto"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: 240,
                backgroundColor: "var(--select-panel-bg, #f5f1ea)",
                color: "var(--select-panel-fg, hsl(0 0% 7%))",
              }}
            >
              {options.length === 0 ? (
                <li className="px-4 py-3 text-sm font-body text-muted-foreground cursor-default">No options</li>
              ) : (
                options.map((opt) => (
                  <li key={opt.value} role="option" aria-selected={opt.value === value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm font-body text-left transition-colors focus:outline-none focus:bg-accent/20"
                      style={{
                        backgroundColor: opt.value === value
                          ? "var(--accent)"
                          : "transparent",
                        color: opt.value === value
                          ? "var(--accent-foreground, #fff)"
                          : "var(--select-panel-fg, hsl(0 0% 7%))",
                      }}
                      onMouseEnter={(e) => {
                        if (opt.value !== value) {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            "var(--select-panel-hover, hsl(0 0% 96%))";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (opt.value !== value) {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            "transparent";
                        }
                      }}
                    >
                      <span>{opt.label}</span>
                      {opt.value === value && <Check size={14} />}
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}