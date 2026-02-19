"use client";

import { useState, useEffect } from "react";
import FilterBar from "@/components/FilterBar";
import TrendCard from "@/components/TrendCard";
import { api } from "@/lib/api";
import { Trend } from "@/types";

export default function TrendsPage() {
  const [filter, setFilter] = useState("All Trends");
  const [trends, setTrends] = useState<Trend[]>([]);

  useEffect(() => {
    api.getTrends().then(setTrends).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Trends</h1>
        <FilterBar activeFilter={filter} onFilterChange={setFilter} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => (
          <TrendCard key={trend.id} trend={trend} />
        ))}
      </div>

      {filter === "For You" && (
        <div className="mt-8 border border-border bg-muted p-8 text-center">
          <p className="text-foreground/60">
            Upload a photo in your{" "}
            <a href="/profile" className="font-medium text-foreground hover:underline">
              Profile
            </a>{" "}
            to get personalized trend recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
