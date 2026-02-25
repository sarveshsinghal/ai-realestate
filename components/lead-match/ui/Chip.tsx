// components/lead-match/ui/Chip.tsx
export default function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const cls =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "negative"
      ? "bg-rose-50 text-rose-900 border-rose-200"
      : "bg-neutral-50 text-neutral-800 border-neutral-200";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}
