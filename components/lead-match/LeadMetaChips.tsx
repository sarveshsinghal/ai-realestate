// components/lead-match/LeadMetaChips.tsx
import type { LeadSummary } from "./types";
import Chip from "./ui/Chip";

function money(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-LU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function LeadMetaChips({ lead }: { lead: LeadSummary }) {
  const budget =
    lead.budgetMin || lead.budgetMax ? `${money(lead.budgetMin)} – ${money(lead.budgetMax)}` : undefined;

  const beds =
    lead.bedroomsMin || lead.bedroomsMax
      ? `${lead.bedroomsMin ?? "—"}–${lead.bedroomsMax ?? "—"} beds`
      : undefined;

  const communes = (lead.communes ?? []).slice(0, 2);
  const communesMore = (lead.communes ?? []).length - communes.length;

  const must = (lead.mustHaves ?? []).slice(0, 2);
  const mustMore = (lead.mustHaves ?? []).length - must.length;

  return (
    <div className="flex flex-wrap gap-2">
      {lead.kind ? <Chip tone="neutral">{lead.kind}</Chip> : null}
      {budget ? <Chip tone="neutral">{budget}</Chip> : null}
      {beds ? <Chip tone="neutral">{beds}</Chip> : null}

      {communes.map((c) => (
        <Chip key={c} tone="neutral">
          {c}
        </Chip>
      ))}
      {communesMore > 0 ? <Chip tone="neutral">+{communesMore} areas</Chip> : null}

      {must.map((m) => (
        <Chip key={m} tone="positive">
          {m}
        </Chip>
      ))}
      {mustMore > 0 ? <Chip tone="positive">+{mustMore} must-haves</Chip> : null}
    </div>
  );
}
