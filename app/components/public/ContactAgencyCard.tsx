// app/components/public/ListingGallery.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ListingGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const imgs = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const cover = imgs[0] ?? "/placeholder.jpg";
  const thumbs = imgs.slice(1, 6);

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const lightboxImages = imgs.length ? imgs : ["/placeholder.jpg"];

  function openAt(i: number) {
    setIdx(i);
    setOpen(true);
  }

  function prev() {
    setIdx((p) => (p - 1 + lightboxImages.length) % lightboxImages.length);
  }

  function next() {
    setIdx((p) => (p + 1) % lightboxImages.length);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        {/* Cover */}
        <button
          className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border bg-muted/30 shadow-sm"
          onClick={() => openAt(0)}
          type="button"
        >
          <Image
            src={cover}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs text-white">
            <Images className="h-4 w-4" />
            {imgs.length || 1} photos
          </div>
        </button>

        {/* Thumbs */}
        <div className="grid grid-cols-2 gap-3">
          {thumbs.map((src, i) => (
            <button
              key={`${src}-${i}`}
              className="relative aspect-[16/10] overflow-hidden rounded-3xl border bg-muted/30 shadow-sm"
              onClick={() => openAt(i + 1)}
              type="button"
            >
              <Image
                src={src}
                alt={`${title} photo ${i + 2}`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 20vw"
              />
            </button>
          ))}

          {/* If fewer thumbs, fill with placeholders for consistent layout */}
          {thumbs.length < 4
            ? Array.from({ length: 4 - thumbs.length }).map((_, j) => (
                <div
                  key={`ph-${j}`}
                  className="relative aspect-[16/10] overflow-hidden rounded-3xl border bg-muted/20"
                />
              ))
            : null}
        </div>
      </div>

      {/* Lightbox */}
      {open ? (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/80">
                {idx + 1}/{lightboxImages.length}
              </div>
              <Button
                variant="secondary"
                className="rounded-full bg-white/10 text-white hover:bg-white/15"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative mt-4 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <Image
                src={lightboxImages[idx]}
                alt={`${title} photo ${idx + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                className={cn("rounded-full bg-white/10 text-white hover:bg-white/15")}
                onClick={prev}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Prev
              </Button>

              <Button
                variant="secondary"
                className={cn("rounded-full bg-white/10 text-white hover:bg-white/15")}
                onClick={next}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}