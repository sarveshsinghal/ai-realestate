// components/lead-match/ui/StatusPill.tsx
export default function StatusPill({
  status,
}: {
  status: "NEW" | "NEEDS_REVIEW" | "CONTACTED" | "QUALIFIED" | "CLOSED";
}) {
  const cls =
    status === "NEEDS_REVIEW"
      ? "bg-amber-100 text-amber-900"
      : status === "NEW"
      ? "bg-blue-100 text-blue-900"
      : status === "QUALIFIED"
      ? "bg-emerald-100 text-emerald-900"
      : status === "CONTACTED"
      ? "bg-neutral-100 text-neutral-800"
      : "bg-neutral-200 text-neutral-800";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status.replace("_", " ")}</span>;
}
