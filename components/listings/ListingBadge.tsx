export default function ListingBadge({ badge }: { badge?: string | null }) {
  if (!badge || badge === "NONE") return null;

  const label = badge === "TRENDING" ? "Trending" : badge;

  return (
    <div className="rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
      {label}
    </div>
  );
}