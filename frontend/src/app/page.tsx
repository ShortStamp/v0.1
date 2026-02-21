import Link from "next/link";
import { TrendingUp, Search, Palette } from "lucide-react";
import TrendCard from "@/components/TrendCard";
import StartBuildingButton from "@/components/StartBuildingButton";
import { sampleTrends } from "@/lib/data";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
<<<<<<< Updated upstream
      <section className="relative flex flex-col items-center gap-6 px-4 pb-20 pt-28 text-center overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-soft/60 via-muted/30 to-background" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <h1 className="max-w-2xl text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">
            Discover What&apos;s Trending.
=======
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
>>>>>>> Stashed changes
            <br />
            <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
              Build Your Perfect Look.
            </span>
          </h1>

          <p className="max-w-xl text-lg text-foreground/70 leading-relaxed font-sans font-light">
            Search trending makeup styles, build your personalized toolbox, and find the best
            prices across every major retailer — all in one place.
          </p>

          <div className="flex flex-col items-center gap-6 pt-4 sm:flex-row">
            <StartBuildingButton />
            <Link
              href="/trends"
<<<<<<< Updated upstream
              className="text-xs font-medium uppercase tracking-[0.1em] text-foreground/40 underline underline-offset-4 hover:text-accent"
=======
              className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/60 transition-colors hover:text-accent font-sans"
>>>>>>> Stashed changes
            >
              Explore trends →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-white/50 px-4 py-24 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-xs font-bold uppercase tracking-[0.3em] text-accent font-sans">
            The ShortStamp Experience
          </h2>
<<<<<<< Updated upstream
          <div className="grid gap-10 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-500">
                <Search className="h-5 w-5" />
=======
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
>>>>>>> Stashed changes
              </div>
            </div>
<<<<<<< Updated upstream
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-500">
                <Palette className="h-5 w-5" />
=======
            <div className="group flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <Palette className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Build Your Look</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Pick products for each part of your face and see if they match as a set.
                </p>
>>>>>>> Stashed changes
              </div>
            </div>
<<<<<<< Updated upstream
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                <TrendingUp className="h-5 w-5" />
=======
            <div className="group flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider font-sans">Compare Prices</h3>
                <p className="text-sm leading-relaxed text-foreground/60 font-sans">
                  Find the cheapest place to buy every product across all major retailers.
                </p>
>>>>>>> Stashed changes
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending now */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-end justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Hot Picks</p>
              <h2 className="text-3xl font-bold font-serif">Trending Now</h2>
            </div>
            <Link
              href="/trends"
<<<<<<< Updated upstream
              className="text-xs font-medium uppercase tracking-[0.1em] text-foreground/50 underline underline-offset-4 hover:text-accent"
=======
              className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-accent font-sans"
>>>>>>> Stashed changes
            >
              View all collections
            </Link>
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
        </div>
      </section>
    </div>
  );
}
