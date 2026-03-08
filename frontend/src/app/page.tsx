"use client";

import Link from "next/link";
import { TrendingUp, Search, Palette, FlaskConical, ClipboardList } from "lucide-react";
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
              Skin Conflict Checker for Makeup
            </p>
          </div>
          
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl font-serif">
            Pick Makeup. Check Your Skin. Catch Chemical Conflicts.
          </h1>

          <p className="max-w-xl text-lg text-foreground/70 leading-relaxed font-sans font-light">
            We check every product against your skin type, tone, and concerns — and against each other for chemical incompatibilities like pilling and ingredient conflicts.
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
          <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-accent font-sans">
            How It Works
          </h2>
          <p className="mb-16 text-center text-sm text-foreground/50 font-sans">
            Two conflict checks. One kit. Zero guesswork.
          </p>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <ClipboardList className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-white font-sans">1</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Take the Quiz</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Answer 5 questions about your skin type, tone, and concerns. We use this to flag products that won&apos;t suit <em>you</em>.
                </p>
              </div>
            </div>
            <div className="group flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <Palette className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-white font-sans">2</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Build Your Kit</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Pick a product for each face area — foundation, concealer, blush, and more.
                </p>
              </div>
            </div>
            <div className="group flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <FlaskConical className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-white font-sans">3</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">AI Conflict Scan</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Our AI checks every product against your quiz profile <strong>and</strong> against each other — catching pilling, clashing finishes, and ingredient conflicts.
                </p>
              </div>
            </div>
            <div className="group flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <TrendingUp className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-white font-sans">4</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Buy at Best Price</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Once your kit is conflict-free, we find the lowest price for every product across all major retailers.
                </p>
              </div>
            </div>
          </div>

          {/* Conflict callout */}
          <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-white px-8 py-8 text-center sm:flex-row sm:text-left">
            <div className="shrink-0 rounded-full bg-red-50 p-4">
              <FlaskConical className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground font-sans mb-1">What &ldquo;conflicts&rdquo; means</p>
              <p className="text-sm text-foreground/60 font-sans leading-relaxed">
                We flag two types: products that clash with <strong>your skin</strong> (based on quiz answers), and products that clash with <strong>each other</strong> — like a silicone primer under a water-based foundation that will pill.
              </p>
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
