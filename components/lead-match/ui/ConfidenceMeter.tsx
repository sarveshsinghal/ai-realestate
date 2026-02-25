// components/lead-match/ui/ConfidenceMeter.tsx
export default function ConfidenceMeter({ value }: { value: number | null }) {
  const tier = value == null ? "—" : value >= 0.8 ? "High" : value >= 0.6 ? "Medium" : "Low";
  const pct = value == null ? 0 : Math.round(value * 100);

  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-end gap-2">
        <div className="text-xs font-medium text-neutral-700" title="AI profile confidence">
          Confidence
        </div>
        <div className="text-xs font-semibold text-neutral-900">{tier}</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
