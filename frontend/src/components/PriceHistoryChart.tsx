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
  { color: "#000000" },
  { color: "#666666", dash: "5 5" },
  { color: "#999999", dash: "10 5" },
  { color: "#333333", dash: "3 3" },
  { color: "#AAAAAA", dash: "8 3 2 3" },
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
      <div className="border border-border bg-muted p-8 text-center text-sm text-foreground/40">
        Loading price history...
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="border border-border bg-muted p-8 text-center text-sm text-foreground/40">
        No price history data available yet.
      </div>
    );
  }

  return (
    <div>
      <div className="border border-border bg-white p-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#999" }}
              tickLine={false}
              axisLine={{ stroke: "#E0E0E0" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#999" }}
              tickLine={false}
              axisLine={{ stroke: "#E0E0E0" }}
              tickFormatter={(v: number) => `$${v}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E0E0E0",
                borderRadius: 0,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => value != null ? `$${value.toFixed(2)}` : "$0.00"}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
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
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lowest ever */}
      {lowestEver && (
        <div className="mt-3 border border-border bg-muted px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">
            Lowest Price Recorded
          </p>
          <p className="text-sm font-bold text-foreground">
            ${lowestEver.price.toFixed(2)} at {lowestEver.retailer}
            <span className="ml-2 text-xs font-normal text-foreground/40">
              {new Date(lowestEver.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
