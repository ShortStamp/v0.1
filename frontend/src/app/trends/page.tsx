"use client";

import { useState } from "react";
import FilterBar from "@/components/FilterBar";
import TrendCard from "@/components/TrendCard";
import { sampleTrends } from "@/lib/data";

export default function TrendsPage() {
  const [filter, setFilter] = useState("All Trends");

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Curated Collections</p>
          <h1 className="text-4xl font-bold font-serif">Beauty Trends</h1>
        </div>
        <FilterBar activeFilter={filter} onFilterChange={setFilter} />
      </div>

<<<<<<< Updated upstream
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sampleTrends.map((trend) => (
=======
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => (
>>>>>>> Stashed changes
          <TrendCard key={trend.id} trend={trend} />
        ))}
      </div>

<<<<<<< Updated upstream
      {filter === "For You" && (
        <div className="mt-8 rounded-2xl border border-border bg-muted p-8 text-center">
          <p className="text-foreground/60">
            Upload a photo in your{" "}
            <a href="/profile" className="font-medium text-accent hover:underline">
=======
      {filter === "For You" && trends.length === 0 && (
        <div className="mt-12 rounded-3xl border border-border/50 bg-white p-12 text-center shadow-xl shadow-accent/5">
          <p className="text-foreground/60 font-sans leading-relaxed">
            Upload a photo in your{" "}
            <a href="/profile" className="font-bold text-accent hover:underline underline-offset-4">
>>>>>>> Stashed changes
              Profile
            </a>{" "}
            to get personalized trend recommendations powered by your unique features.
          </p>
        </div>
      )}
    </div>
  );
}
