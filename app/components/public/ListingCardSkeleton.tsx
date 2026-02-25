// app/components/public/ListingCardSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-background/70 shadow-sm">
      <div className="relative aspect-[4/3] w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}