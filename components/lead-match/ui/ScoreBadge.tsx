// components/lead-match/ui/ScoreBadge.tsx
export default function ScoreBadge({ value }: { value: number }) {
  const tier = value >= 0.8 ? "High" : value >= 0.6 ? "Med" : "Low";
  const cls =
    value >= 0.8
      ? "bg-emerald-100 text-emerald-900"
      : value >= 0.6
      ? "bg-amber-100 text-amber-900"
      : "bg-rose-100 text-rose-900";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`} title={`Overall score: ${value.toFixed(3)}`}>
      {tier} • {Math.round(value * 100)}%
    </span>
  );
}
