import * as React from "react";

import { cn } from "@/lib/utils";

// data-lenis-prevent-wheel on the container: the site's smooth-scroll library (Lenis) would otherwise
// swallow mouse-wheel events, so the table could only be scrolled by dragging its scrollbar.
//
// fitViewport: sizes the scroll area so its bottom edge lands at the bottom of the window when the page is
// at the top. That keeps the horizontal scrollbar on screen instead of below the fold.
const useFitViewport = (enabled: boolean) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.maxHeight = `${Math.max(256, window.innerHeight - top - 24)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [enabled]);
  return ref;
};

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string; fitViewport?: boolean }
>(({ className, containerClassName, fitViewport = false, ...props }, ref) => {
  const containerRef = useFitViewport(fitViewport);
  return (
    <div
      ref={containerRef}
      data-lenis-prevent-wheel
      className={cn(
        "relative w-full overflow-auto [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-foreground/40 [&::-webkit-scrollbar-thumb]:rounded-sm",
        containerClassName,
      )}
    >
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "sticky top-0 z-20 bg-background shadow-[0_1px_0_hsl(var(--border))] h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
