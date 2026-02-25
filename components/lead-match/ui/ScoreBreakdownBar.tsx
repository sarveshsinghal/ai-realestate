// components/lead-match/ui/ScoreBreakdownBar.tsx
export default function ScoreBreakdownBar({
  structured,
  semantic,
  freshness,
}: {
  structured: number;
  semantic: number;
  freshness: number | null;
}) {
  const s = Math.max(0, Math.min(1, structured));
  const e = Math.max(0, Math.min(1, semantic));
  const f = freshness == null ? null : Math.max(0, Math.min(1, freshness));

  return (
    <div className="space-y-1">
      {/* Structured */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100" title={`Structured: ${s.toFixed(3)}`}>
        <div className="h-full bg-neutral-900" style={{ width: `${Math.round(s * 100)}%` }} />
      </div>

      {/* Semantic */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100" title={`Semantic: ${e.toFixed(3)}`}>
        <div className="h-full bg-neutral-700" style={{ width: `${Math.round(e * 100)}%` }} />
      </div>

      {/* Freshness (optional) */}
      {f != null ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100" title={`Freshness: ${f.toFixed(3)}`}>
          <div className="h-full bg-neutral-500" style={{ width: `${Math.round(f * 100)}%` }} />
        </div>
      ) : null}

      <div className="text-[11px] text-neutral-500">
        Structured {Math.round(s * 100)}% • Semantic {Math.round(e * 100)}%
        {f != null ? ` • Freshness ${Math.round(f * 100)}%` : ""}
      </div>
    </div>
  );
}
