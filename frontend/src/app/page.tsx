import Link from "next/link";
import { TrendingUp, Search, ArrowRight, Palette } from "lucide-react";
import TrendCard from "@/components/TrendCard";
import { sampleTrends } from "@/lib/data";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-4 pb-16 pt-24 text-center">
        <div className="flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
          <Palette className="h-4 w-4" />
          Beauty Trends & Price Comparison
        </div>

        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Discover What&apos;s Trending.
          <br />
          <span className="text-accent">Build Your Perfect Look.</span>
        </h1>

        <p className="max-w-lg text-lg text-foreground/60">
          Search trending makeup styles, build your toolbox, and find the best
          prices across every retailer — all in one place.
        </p>

        <div className="flex gap-3">
          <Link
            href="/build"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Start Building <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trends"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold transition-colors hover:bg-muted"
          >
            Explore Trends
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-bold">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Discover Trends</h3>
              <p className="text-sm text-foreground/60">
                Browse trending makeup styles scored by our ShortStamp algorithm.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Build Your Look</h3>
              <p className="text-sm text-foreground/60">
                Pick products for each part of your face and see if they match as a set.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Compare Prices</h3>
              <p className="text-sm text-foreground/60">
                Find the cheapest place to buy every product across all major retailers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending now */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Trending Now</h2>
            <Link
              href="/trends"
              className="text-sm font-medium text-accent hover:underline"
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
