"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface PriceEntry {
  date: string;
  price: number;
  retailer: string;
}

interface Props {
  productId: string;
}

const STROKE_STYLES: { color: string; dash?: string }[] = [
  { color: "#E84B8A" }, // Accent
  { color: "#D946A8" }, // Secondary
  { color: "#BE185D" }, // Pink Deep
  { color: "#2D2D2D", dash: "5 5" }, // Foreground
  { color: "#F9A8D0", dash: "3 3" }, // Accent Light
];

export default function PriceHistoryChart({ productId }: Props) {
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.getPriceHistory(productId);
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const { chartData, retailers, lowestEver } = useMemo(() => {
    if (entries.length === 0) return { chartData: [], retailers: [], lowestEver: null };

    // Get unique retailers
    const retailerSet = new Set(entries.map((e) => e.retailer));
    const retailers = Array.from(retailerSet);

    // Group by date
    const dateMap = new Map<string, Record<string, number>>();
    for (const entry of entries) {
      const dateKey = entry.date.slice(0, 10); // YYYY-MM-DD
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
      dateMap.get(dateKey)![entry.retailer] = entry.price;
    }

    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, prices]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        ...prices,
      }));

    // Find lowest ever price
    let lowestEver: { price: number; retailer: string; date: string } | null = null;
    for (const entry of entries) {
      if (!lowestEver || entry.price < lowestEver.price) {
        lowestEver = { price: entry.price, retailer: entry.retailer, date: entry.date };
      }
    }

    return { chartData, retailers, lowestEver };
  }, [entries]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center text-[10px] font-bold uppercase tracking-widest text-foreground/20 font-sans">
        Tracking historical pricing…
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center text-[10px] font-bold uppercase tracking-widest text-foreground/20 font-sans">
        No historical data available for this item.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#999", fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#F0F0F0" }}
              dy={10}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#999", fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#F0F0F0" }}
              tickFormatter={(v: number) => `$${v}`}
              domain={["auto", "auto"]}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
                border: "1px solid #FECDD6",
                borderRadius: "16px",
                fontSize: "11px",
                fontWeight: "600",
                boxShadow: "0 10px 15px -3px rgba(232, 75, 138, 0.05)",
              }}
              itemStyle={{ padding: "2px 0" }}
              formatter={(value: number | undefined) => value != null ? `$${value.toFixed(2)}` : "$0.00"}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingBottom: 20, textTransform: "uppercase", letterSpacing: "0.1em" }}
            />
            {retailers.map((retailer, i) => {
              const style = STROKE_STYLES[i % STROKE_STYLES.length];
              return (
                <Line
                  key={retailer}
                  type="monotone"
                  dataKey={retailer}
                  stroke={style.color}
                  strokeDasharray={style.dash}
                  strokeWidth={3}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: style.color }}
                  connectNulls
                  animationDuration={1500}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lowest ever */}
      {lowestEver && (
        <div className="flex items-center justify-between rounded-2xl bg-accent/5 px-6 py-4 border border-accent/10">
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent/50 font-sans">
              Lowest Recorded Price
            </p>
            <p className="text-base font-bold text-foreground font-sans">
              ${lowestEver.price.toFixed(2)} <span className="text-xs font-medium text-foreground/40 font-serif italic ml-1">at {lowestEver.retailer}</span>
            </p>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 font-sans">
              {new Date(lowestEver.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
