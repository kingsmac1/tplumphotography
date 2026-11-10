import { useState } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "./useBodyScrollLock";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  useBodyScrollLock(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setWorking(true);
    setError("");
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden" onClick={onClose}>
      <div
        className="bg-background border border-border max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm font-body text-muted-foreground mb-6">{message}</p>
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
            <p className="text-sm text-destructive font-body">{error}</p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className={`px-4 py-2 text-sm font-body font-medium rounded-md transition-colors ${
              working
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {working ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}