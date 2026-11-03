"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeso } from "@/lib/money";

type Point = { month: string; label: string; amount: number };

const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** One series, one hue: the current month in teal, earlier months in a quiet grey. No legend. */
export function CollectionsChart({ data, currentMonth }: { data: Point[]; currentMonth: string }) {
  return (
    <div className="h-[220px] w-full" role="img" aria-label={`Collections by month: ${data.map((d) => `${d.label} ${formatPeso(d.amount)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rule)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => (v === 0 ? "0" : `₱${compact.format(v / 100)}`)}
          />
          <Tooltip
            cursor={{ fill: "var(--raised)" }}
            formatter={(v) => [formatPeso(Number(v)), "Collected"]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
          />
          <Bar dataKey="amount" radius={0} maxBarSize={44} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === currentMonth ? "var(--teal)" : "var(--chart-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
