// app/components/public/PriceHistoryChart.tsx
"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-LU", { style: "currency", currency: "EUR" }).format(n);
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  // e.g. 21.02
  return d.toLocaleDateString("de-LU", { day: "2-digit", month: "2-digit" });
}

export default function PriceHistoryChart({
  points,
}: {
  points: { price: number; recordedAt: string }[];
}) {
  if (!points?.length || points.length < 2) return null;

  const data = points
    .slice()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((p) => ({
      date: formatDateShort(p.recordedAt),
      price: p.price,
      recordedAt: p.recordedAt,
    }));

  return (
    <div className="rounded-3xl border bg-background/70 p-5 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Price history</h2>
          <p className="text-sm text-muted-foreground">Recent changes for this listing.</p>
        </div>
      </div>

      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={80}
              tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
            />
            <Tooltip
              formatter={(value) => formatEUR(Number(value))}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="price"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}