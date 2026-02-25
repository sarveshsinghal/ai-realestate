// app/components/AISearchBar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AISearchSuggest from "@/app/components/public/AISearchSuggest";

export default function AISearchBar({
  placeholder = 'Try: "Appartement 2 chambres à Kirchberg, max 2500€"',
  className,
  compact = false,
}: {
  placeholder?: string;
  className?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    setOpen(false);
    router.push(query ? `/listings?q=${encodeURIComponent(query)}` : "/listings");
  }

  // close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div ref={wrapRef} className="relative">
        <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            "h-11 rounded-full pl-9 pr-28 shadow-sm",
            compact && "h-10"
          )}
        />

        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <Button
            type="submit"
            disabled={!q.trim()}
            className="h-9 rounded-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI Search
          </Button>
        </div>

        <AISearchSuggest
          query={q}
          open={open && q.trim().length >= 2}
          onClose={() => setOpen(false)}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setQ("Appartement 2 chambres à Kirchberg, max 2500€")}
          className="rounded-full border bg-background px-3 py-1 hover:bg-muted/30"
        >
          Kirchberg • 2 beds • ≤ 2500€
        </button>
        <button
          type="button"
          onClick={() => setQ("Maison à vendre à Strassen, 4 chambres")}
          className="rounded-full border bg-background px-3 py-1 hover:bg-muted/30"
        >
          Strassen • house • sale
        </button>
        <button
          type="button"
          onClick={() => setQ("Studio à louer proche tram, max 1700€")}
          className="rounded-full border bg-background px-3 py-1 hover:bg-muted/30"
        >
          Studio • rent • near tram
        </button>
      </div>
    </form>
  );
}