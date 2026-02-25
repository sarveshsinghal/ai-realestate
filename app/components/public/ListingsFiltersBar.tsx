// app/components/public/ListingsFiltersBar.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

import ActiveFilterChips from "@/app/components/public/ActiveFilterChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function get(sp: ReturnType<typeof useSearchParams>, key: string) {
  return sp.get(key) ?? "";
}

export default function ListingsFiltersBar() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(get(sp, "q"));
  const [commune, setCommune] = useState(get(sp, "commune"));
  const [kind, setKind] = useState(get(sp, "kind")); // SALE/RENT
  const [propertyType, setPropertyType] = useState(get(sp, "propertyType"));
  const [bedrooms, setBedrooms] = useState(get(sp, "bedrooms"));
  const [minPrice, setMinPrice] = useState(get(sp, "minPrice"));
  const [maxPrice, setMaxPrice] = useState(get(sp, "maxPrice"));
  const [minSize, setMinSize] = useState(get(sp, "minSize"));
  const [maxSize, setMaxSize] = useState(get(sp, "maxSize"));
  const [sort, setSort] = useState(get(sp, "sort") || "recommended");

  const href = useMemo(() => {
    const p = new URLSearchParams(sp.toString());

    const setOrDel = (k: string, v: string) => {
      if (v.trim()) p.set(k, v.trim());
      else p.delete(k);
    };

    setOrDel("q", q);
    setOrDel("commune", commune);
    setOrDel("kind", kind);
    setOrDel("propertyType", propertyType);
    setOrDel("bedrooms", bedrooms);
    setOrDel("minPrice", minPrice);
    setOrDel("maxPrice", maxPrice);
    setOrDel("minSize", minSize);
    setOrDel("maxSize", maxSize);
    setOrDel("sort", sort);

    // reset paging state
    p.delete("page");
    p.delete("cursor");

    const qs = p.toString();
    return qs ? `/listings?${qs}` : "/listings";
  }, [
    sp,
    q,
    commune,
    kind,
    propertyType,
    bedrooms,
    minPrice,
    maxPrice,
    minSize,
    maxSize,
    sort,
  ]);

  function apply() {
    router.push(href);
  }

  function reset() {
    router.push("/listings");
  }

  return (
    <div className="sticky top-16 z-40 -mx-4 border-y bg-background/75 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
            Filters
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="rounded-full" onClick={reset} type="button">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={apply}
              type="button"
            >
              Apply
            </Button>
          </div>
        </div>

        <ActiveFilterChips />

        <div className={cn("grid gap-2", "sm:grid-cols-2 lg:grid-cols-6")}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-10 rounded-2xl lg:col-span-2"
          />

          <Input
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
            placeholder="Commune"
            className="h-10 rounded-2xl"
          />

          <Select value={kind || "ALL"} onValueChange={(v) => setKind(v === "ALL" ? "" : v)}>
            <SelectTrigger className="h-10 rounded-2xl">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SALE">Sale</SelectItem>
              <SelectItem value="RENT">Rent</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={propertyType || "ALL"}
            onValueChange={(v) => setPropertyType(v === "ALL" ? "" : v)}
          >
            <SelectTrigger className="h-10 rounded-2xl">
              <SelectValue placeholder="Property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="APARTMENT">Apartment</SelectItem>
              <SelectItem value="HOUSE">House</SelectItem>
              <SelectItem value="STUDIO">Studio</SelectItem>
              <SelectItem value="ROOM">Room</SelectItem>
              <SelectItem value="LAND">Land</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={bedrooms || "ANY"}
            onValueChange={(v) => setBedrooms(v === "ANY" ? "" : v)}
          >
            <SelectTrigger className="h-10 rounded-2xl">
              <SelectValue placeholder="Bedrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Any</SelectItem>
              <SelectItem value="0">0+</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Input
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min €"
            inputMode="numeric"
            className="h-10 rounded-2xl"
          />
          <Input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max €"
            inputMode="numeric"
            className="h-10 rounded-2xl"
          />
          <Input
            value={minSize}
            onChange={(e) => setMinSize(e.target.value)}
            placeholder="Min sqm"
            inputMode="numeric"
            className="h-10 rounded-2xl"
          />
          <Input
            value={maxSize}
            onChange={(e) => setMaxSize(e.target.value)}
            placeholder="Max sqm"
            inputMode="numeric"
            className="h-10 rounded-2xl"
          />

          <div className="sm:col-span-2 lg:col-span-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 rounded-2xl">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: Low → High</SelectItem>
                <SelectItem value="price_high">Price: High → Low</SelectItem>
                <SelectItem value="best">Best score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}