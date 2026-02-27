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
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Curated Collections</p>
          <h1 className="text-4xl font-bold font-serif">Beauty Trends</h1>
        </div>
        <FilterBar activeFilter={filter} onFilterChange={setFilter} />
      </div>

      <div className="flex flex-wrap justify-center gap-8">
        {trends.map((trend) => (
          <div key={trend.id} className="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)]">
            <TrendCard trend={trend} />
          </div>
        ))}
      </div>

      {filter === "For You" && trends.length === 0 && (
        <div className="mt-12 rounded-3xl border border-border/50 bg-white p-12 text-center shadow-xl shadow-accent/5">
          <p className="text-foreground/60 font-sans leading-relaxed">
            Upload a photo in your{" "}
            <a href="/profile" className="font-bold text-accent hover:underline underline-offset-4">
              Profile
            </a>{" "}
            to get personalized trend recommendations powered by your unique features.
          </p>
        </div>
      )}
    </div>
  );
}
