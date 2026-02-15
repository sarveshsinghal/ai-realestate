import { Badge } from "@/components/ui/badge";
import type { DealGrade } from "@/lib/scoring";

export function DealScoreBadge({ grade }: { grade: DealGrade }) {
  const variant =
    grade === "A" ? "default" : grade === "B" ? "secondary" : "outline";

  const label =
    grade === "A" ? "Deal A" : grade === "B" ? "Deal B" : "Deal C";

  return <Badge variant={variant}>{label}</Badge>;
}
