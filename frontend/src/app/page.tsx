"use client";

import Link from "next/link";
import { TrendingUp, Search, Palette } from "lucide-react";
import TrendCard from "@/components/TrendCard";
import StartBuildingButton from "@/components/StartBuildingButton";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trend } from "@/types";

export default function Home() {
  const [trends, setTrends] = useState<Trend[]>([]);

  useEffect(() => {
    api.getTrends().then((data) => setTrends(data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center gap-6 px-4 pb-20 pt-28 text-center overflow-hidden">
        <div className="absolute inset-0 bg-muted/30" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <h1 className="max-w-2xl text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">
            Discover What&apos;s Trending.
            <br />
            Build Your Perfect Look.
          </h1>

          <p className="max-w-lg text-base text-foreground/50">
            Search trending makeup styles, build your toolbox, and find the best
            prices across every retailer — all in one place.
          </p>

          <div className="flex flex-col items-center gap-4 pt-2">
            <StartBuildingButton />
            <Link
              href="/trends"
              className="text-xs font-medium uppercase tracking-[0.1em] text-foreground/40 underline underline-offset-4 hover:text-foreground"
            >
              or explore trends
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-foreground/40">
            How It Works
          </h2>
          <div className="grid gap-10 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center bg-foreground text-background">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Discover Trends</h3>
              <p className="text-sm text-foreground/50">
                Browse trending makeup styles scored by our ShortStamp algorithm.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center bg-foreground text-background">
                <Palette className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Build Your Look</h3>
              <p className="text-sm text-foreground/50">
                Pick products for each part of your face and see if they match as a set.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center bg-foreground text-background">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Compare Prices</h3>
              <p className="text-sm text-foreground/50">
                Find the cheapest place to buy every product across all major retailers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending now */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em]">Trending Now</h2>
            <Link
              href="/trends"
              className="text-xs font-medium uppercase tracking-[0.1em] text-foreground/50 underline underline-offset-4 hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
