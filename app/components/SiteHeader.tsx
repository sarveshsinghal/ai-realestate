// app/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function buildListingsHref(params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `/listings?${qs}` : "/listings";
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const isListings = pathname === "/listings";
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  const activeHref = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    return buildListingsHref(p);
  }, [sp]);

  function submitSearch() {
    const p = new URLSearchParams(sp.toString());
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    p.delete("page");
    p.delete("cursor");
    router.push(buildListingsHref(p));
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 text-white shadow-sm">
            <span className="text-sm font-semibold">E</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">EstateIQ</div>
            <div className="text-xs text-muted-foreground">Find your next place</div>
          </div>
        </Link>

        <div className="flex-1" />

        {/* Desktop search */}
        <div className="hidden w-full max-w-xl items-center gap-2 md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
              placeholder="Search by title, commune, keywords…"
              className="h-11 rounded-full pl-9 pr-28 shadow-sm"
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className={cn("h-9 rounded-full", !isListings && "opacity-80")}
                onClick={() => router.push(activeHref)}
                type="button"
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                Filters
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={submitSearch}
                type="button"
              >
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/listings">Browse</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/agency">Agency</Link>
          </Button>
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>EstateIQ</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitSearch();
                    }}
                    placeholder="Search listings…"
                    className="h-11 rounded-full pl-9"
                  />
                </div>
                <Button
                  className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={submitSearch}
                  type="button"
                >
                  Search
                </Button>

                <div className="grid gap-2 pt-2">
                  <Button asChild variant="secondary" className="w-full rounded-full">
                    <Link href="/listings">Browse listings</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href="/agency">Agency portal</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}