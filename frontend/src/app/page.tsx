import Link from "next/link";
import { TrendingUp, Search, ArrowRight, Palette } from "lucide-react";
import TrendCard from "@/components/TrendCard";
import { sampleTrends } from "@/lib/data";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-4 pb-20 pt-28 text-center">
        <h1 className="max-w-2xl text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">
          Discover What&apos;s Trending.
          <br />
          Build Your Perfect Look.
        </h1>

        <p className="max-w-lg text-base text-neutral-500">
          Search trending makeup styles, build your toolbox, and find the best
          prices across every retailer — all in one place.
        </p>

        <div className="flex flex-col items-center gap-4 pt-2">
          <Link
            href="/build"
            className="inline-flex items-center gap-2 bg-black px-10 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-80"
          >
            Start Building <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trends"
            className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400 underline underline-offset-4 hover:text-black"
          >
            or explore trends
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-neutral-50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            How It Works
          </h2>
          <div className="grid gap-10 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-black">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Discover Trends</h3>
              <p className="text-sm text-neutral-500">
                Browse trending makeup styles scored by our ShortStamp algorithm.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-black">
                <Palette className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Build Your Look</h3>
              <p className="text-sm text-neutral-500">
                Pick products for each part of your face and see if they match as a set.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-black">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide">Compare Prices</h3>
              <p className="text-sm text-neutral-500">
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
              className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500 underline underline-offset-4 hover:text-black"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
