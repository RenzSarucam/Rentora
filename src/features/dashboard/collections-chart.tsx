"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeso } from "@/lib/money";

type Point = { month: string; label: string; collected: number; current: boolean };

const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** One series, one hue: the current month in teal, earlier months in soft gray. */
export function CollectionsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[200px] w-full shrink-0 lg:h-auto lg:min-h-[88px] lg:flex-1" role="img" aria-label={`Collections by month: ${data.map((d) => `${d.label} ${formatPeso(d.collected)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--rule)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => `₱${compact.format(v / 100)}`}
          />
          <Tooltip
            cursor={{ fill: "var(--raised)" }}
            formatter={(value) => [formatPeso(Number(value)), "Collected"]}
            contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 13 }}
          />
          <Bar dataKey="collected" radius={0} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.current ? "var(--teal)" : "var(--chart-5)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
