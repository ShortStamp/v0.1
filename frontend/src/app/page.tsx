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
      <section className="relative flex flex-col items-center gap-6 px-4 pb-28 pt-36 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--pink-soft),transparent_50%),radial-gradient(circle_at_bottom_left,var(--muted),transparent_50%)] opacity-70" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />
        
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
              Discover the Future of Beauty
            </p>
          </div>
          
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl font-serif">
            Discover What&apos;s <span className="text-accent italic">Trending</span>.
            <br />
            Build Your Perfect Look.
          </h1>

          <p className="max-w-xl text-lg text-foreground/70 leading-relaxed font-sans font-light">
            Search trending makeup styles, build your personalized toolbox, and find the best
            prices across every major retailer — all in one place.
          </p>

          <div className="flex flex-col items-center gap-6 pt-4 sm:flex-row">
            <StartBuildingButton />
            <Link
              href="/trends"
              className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/60 transition-colors hover:text-accent font-sans"
            >
              Explore trends →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-white/50 px-6 py-24 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-xs font-bold uppercase tracking-[0.3em] text-accent font-sans">
            The ShortStamp Experience
          </h2>
          <div className="grid gap-12 sm:grid-cols-3">
            <div className="group flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <Search className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Discover Trends</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Browse trending makeup styles scored by our proprietary ShortStamp algorithm.
                </p>
              </div>
            </div>
            <div className="group flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <Palette className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Build Your Look</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Pick products for each part of your face and see if they match as a set.
                </p>
              </div>
            </div>
            <div className="group flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Compare Prices</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Find the cheapest place to buy every product across all major retailers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending now */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-end justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Hot Picks</p>
              <h2 className="text-3xl font-bold font-serif">Trending Now</h2>
            </div>
            <Link
              href="/trends"
              className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-accent font-sans"
            >
              View all collections
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {trends.map((trend) => (
              <div key={trend.id} className="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)]">
                <TrendCard trend={trend} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
