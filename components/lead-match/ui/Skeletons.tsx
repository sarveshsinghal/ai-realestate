// components/lead-match/ui/Skeletons.tsx
export function MatchesSkeleton() {
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
                <div className="mt-3 flex gap-2">
                  <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-100" />
                  <div className="h-6 w-28 animate-pulse rounded-full bg-neutral-100" />
                </div>
              </div>
              <div className="w-[260px]">
                <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-100 ml-auto" />
                <div className="mt-3 h-2 w-full animate-pulse rounded bg-neutral-100" />
                <div className="mt-2 h-2 w-full animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
