// components/lead-match/ui/ReasonChips.tsx
import Chip from "./Chip";
import type { MatchReason } from "../types";

export default function ReasonChips({
  reasons,
  max,
  onMore,
}: {
  reasons: MatchReason[];
  max: number;
  onMore?: () => void;
}) {
  if (!reasons || reasons.length === 0) {
    return <div className="text-xs text-neutral-500">No reasons available yet.</div>;
  }

  const visible = reasons.slice(0, max);
  const remaining = reasons.length - visible.length;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((r, idx) => (
        <Chip key={`${r.label}-${idx}`} tone={r.tone === "positive" ? "positive" : r.tone === "negative" ? "negative" : "neutral"}>
          {r.label}
        </Chip>
      ))}
      {remaining > 0 ? (
        <button
          onClick={onMore}
          className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          +{remaining} more
        </button>
      ) : null}
    </div>
  );
}
