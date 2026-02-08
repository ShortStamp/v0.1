"use client";

import { useState } from "react";
import FilterBar from "@/components/FilterBar";
import TrendCard from "@/components/TrendCard";
import { sampleTrends } from "@/lib/data";

export default function TrendsPage() {
  const [filter, setFilter] = useState("All Trends");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Trends</h1>
        <FilterBar activeFilter={filter} onFilterChange={setFilter} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sampleTrends.map((trend) => (
          <TrendCard key={trend.id} trend={trend} />
        ))}
      </div>

      {filter === "For You" && (
        <div className="mt-8 rounded-xl border border-border bg-muted p-8 text-center">
          <p className="text-foreground/60">
            Upload a photo in your{" "}
            <a href="/profile" className="font-medium text-accent hover:underline">
              Profile
            </a>{" "}
            to get personalized trend recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
