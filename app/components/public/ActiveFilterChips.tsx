// app/components/public/ActiveFilterChips.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Chip = { key: string; label: string; value: string };

function labelize(key: string, value: string) {
  switch (key) {
    case "kind":
      return value === "SALE" ? "Sale" : value === "RENT" ? "Rent" : value;
    case "propertyType":
      return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
    case "bedrooms":
      return `${value}+ beds`;
    case "minPrice":
      return `≥ €${value}`;
    case "maxPrice":
      return `≤ €${value}`;
    case "minSize":
      return `≥ ${value} sqm`;
    case "maxSize":
      return `≤ ${value} sqm`;
    case "commune":
      return value;
    case "q":
      return `“${value}”`;
    case "sort":
      return value === "recommended"
        ? "Recommended"
        : value === "newest"
        ? "Newest"
        : value === "price_low"
        ? "Price ↑"
        : value === "price_high"
        ? "Price ↓"
        : value === "best"
        ? "Best"
        : value;
    default:
      return value;
  }
}

export default function ActiveFilterChips() {
  const sp = useSearchParams();
  const router = useRouter();

  const chips = useMemo(() => {
    const keys = ["q", "commune", "kind", "propertyType", "bedrooms", "minPrice", "maxPrice", "minSize", "maxSize", "sort"];
    const list: Chip[] = [];

    for (const k of keys) {
      const v = sp.get(k);
      if (!v) continue;
      // Don’t show default sort chip unless it’s not recommended
      if (k === "sort" && (v === "recommended" || v === "")) continue;

      list.push({ key: k, value: v, label: labelize(k, v) });
    }

    return list;
  }, [sp]);

  function removeChip(key: string) {
    const p = new URLSearchParams(sp.toString());
    p.delete(key);
    p.delete("cursor");
    p.delete("page");
    const qs = p.toString();
    router.push(qs ? `/listings?${qs}` : "/listings");
  }

  function clearAll() {
    router.push("/listings");
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Badge
          key={`${c.key}:${c.value}`}
          variant="secondary"
          className="group rounded-full bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <span className="mr-1">{c.label}</span>
          <button
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition group-hover:opacity-100"
            onClick={() => removeChip(c.key)}
            type="button"
            aria-label={`Remove ${c.key}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 rounded-full text-muted-foreground hover:text-foreground"
        onClick={clearAll}
        type="button"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Clear all
      </Button>
    </div>
  );
}