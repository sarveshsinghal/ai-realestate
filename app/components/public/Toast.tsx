// app/components/public/Toast.tsx
"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Toast({
  open,
  title = "Done",
  description,
  onClose,
  durationMs = 2200,
  className,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  durationMs?: number;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[120] flex justify-center px-4 sm:justify-end sm:px-6">
      <div
        className={cn(
          "w-full max-w-[520px] rounded-2xl border bg-background shadow-lg",
          "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Close toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}