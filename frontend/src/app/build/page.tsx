"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { categoryGroups } from "@/lib/data";
import { readBuildSlots } from "@/lib/buildSlots";
import { useCompatibility } from "@/lib/useCompatibility";
import { MakeupRecipeCard } from "@/components/MakeupRecipeCard";
import { readOwnedProducts, addOwnedProduct, removeOwnedProduct, type OwnedProduct } from "@/lib/ownedProducts";
import { api } from "@/lib/api";
import type { Product } from "@/types";
import { getDisplayName, getDisplayBrand } from "@/lib/pricing";
import {
  Droplets,
  Eye,
  PenLine,
  Heart,
  Circle,
  ChevronRight,
  Search,
  X,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

const groupIcons: Record<string, LucideIcon> = {
  base: Droplets,
  eyes: Eye,
  brows: PenLine,
  cheeks: Heart,
  lips: Circle,
};

export default function BuildPage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [filledSlots, setFilledSlots] = useState<Record<string, string>>({});
  const [isLoadingQuizRedirect, setIsLoadingQuizRedirect] = useState(false);

  // My Kit state
  const [ownedProducts, setOwnedProducts] = useState<OwnedProduct[]>([]);
  const [kitSearch, setKitSearch] = useState("");
  const [kitResults, setKitResults] = useState<Product[]>([]);
  const [kitSearchOpen, setKitSearchOpen] = useState(false);
  const kitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
    setFilledSlots(readBuildSlots());
    setOwnedProducts(readOwnedProducts());

    const saved = localStorage.getItem("beautyProfile");
    if (!saved) {
      setIsLoadingQuizRedirect(true);
      router.push("/build/quiz");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Debounced kit search
  useEffect(() => {
    if (kitDebounceRef.current) clearTimeout(kitDebounceRef.current);
    if (kitSearch.length < 2) {
      setKitResults([]);
      setKitSearchOpen(false);
      return;
    }
    kitDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.getProducts({ search: kitSearch, per_page: 6 });
        setKitResults(data.items);
        setKitSearchOpen(true);
      } catch {
        setKitResults([]);
      }
    }, 300);
    return () => {
      if (kitDebounceRef.current) clearTimeout(kitDebounceRef.current);
    };
  }, [kitSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (kitRef.current && !kitRef.current.contains(e.target as Node)) {
        setKitSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { compatibilityMap, analyzedIds, isAnalyzing, quotaExceeded, recipeCard, overallScore } = useCompatibility(filledSlots);

  const totalCategories = categoryGroups.reduce((sum, g) => sum + g.categories.length, 0);
  const totalFilled = hasMounted ? Object.keys(filledSlots).length : 0;

  if (isLoadingQuizRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  const displayedGroups = categoryGroups;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
              Validation Engine
            </p>
          </div>
          <h1 className="mb-4 text-4xl font-bold font-serif">
            Set Compatibility Engine
          </h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-foreground/60 font-sans">
              Input your kit. Detect pilling. Perfect your finish. Our AI agents analyze mechanical and chemical stability in real-time.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("beautyProfile");
                router.push("/build/quiz");
              }}
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent transition-all hover:text-pink-deep font-sans"
            >
              Retake Quiz &rarr;
            </button>
          </div>
        </div>

        {/* My Kit */}
        <div className="mb-16 rounded-3xl bg-white p-8 shadow-xl shadow-accent/5 border border-border/50">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Step 0</p>
              <h2 className="text-2xl font-bold font-serif leading-tight">What do you already own?</h2>
              <p className="mt-1.5 text-sm text-foreground/50 font-sans">
                Add products already in your collection. We&apos;ll flag conflicts with new products you browse.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40 font-sans">
              {ownedProducts.length} owned
            </div>
          </div>

          {/* Search input + dropdown */}
          <div ref={kitRef} className="relative mb-6">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-border/60 bg-white px-5 py-4 shadow-sm transition-all focus-within:border-foreground focus-within:shadow-md">
              <Search className="h-5 w-5 shrink-0 text-foreground/40" />
              <input
                type="text"
                placeholder="Search your existing products — e.g. MAC Studio Fix, NARS Concealer..."
                value={kitSearch}
                onChange={(e) => setKitSearch(e.target.value)}
                onFocus={() => kitResults.length > 0 && setKitSearchOpen(true)}
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-foreground/30 font-sans"
              />
            </div>

            {kitSearchOpen && kitResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-white shadow-xl shadow-black/10">
                {kitResults.map((product) => {
                  const alreadyOwned = ownedProducts.some((o) => o.id === product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        if (!alreadyOwned) {
                          const owned: OwnedProduct = {
                            id: product.id,
                            name: getDisplayName(product.name),
                            brand: getDisplayBrand(product.brand),
                            image: product.image ?? "",
                          };
                          addOwnedProduct(owned);
                          setOwnedProducts(readOwnedProducts());
                        }
                        setKitSearch("");
                        setKitSearchOpen(false);
                      }}
                      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                      disabled={alreadyOwned}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted p-1">
                        <img
                          // eslint-disable-next-line @next/next/no-img-element
                          src={product.image || "/placeholder-product.jpg"}
                          alt={getDisplayName(product.name)}
                          className="h-full w-full object-contain"
                          onError={(e) => { e.currentTarget.src = "/placeholder-product.jpg"; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-accent font-sans">{getDisplayBrand(product.brand)}</p>
                        <p className="truncate text-sm font-semibold font-sans text-foreground">{getDisplayName(product.name)}</p>
                      </div>
                      {alreadyOwned ? (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-foreground/30 font-sans">In Kit</span>
                      ) : (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-accent font-sans">+ Add</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Owned chips */}
          {ownedProducts.length > 0 ? (
            <>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/30 font-sans">Already owned</p>
              <div className="flex flex-wrap gap-2">
              {ownedProducts.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-2 rounded-full border border-border/50 bg-muted px-3 py-1.5"
                >
                  <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
                    <img
                      // eslint-disable-next-line @next/next/no-img-element
                      src={o.image || "/placeholder-product.jpg"}
                      alt={o.name}
                      className="h-full w-full object-contain"
                      onError={(e) => { e.currentTarget.src = "/placeholder-product.jpg"; }}
                    />
                  </div>
                  <span className="max-w-[120px] truncate text-[10px] font-bold font-sans text-foreground/70">
                    {o.name}
                  </span>
                  <button
                    onClick={() => {
                      removeOwnedProduct(o.id);
                      setOwnedProducts(readOwnedProducts());
                    }}
                    className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    aria-label={`Remove ${o.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-5 text-center">
              <p className="text-sm font-semibold text-foreground/40 font-sans">No products added yet</p>
              <p className="mt-1 text-[11px] text-foreground/30 font-sans">Products you add here are checked for conflicts as you build your kit</p>
            </div>
          )}
        </div>

        {/* Divider: owned → new */}
        <div className="mb-10 flex items-center gap-6">
          <div className="h-px flex-1 bg-border/50" />
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-white px-5 py-2.5 shadow-sm">
            <ArrowDown className="h-4 w-4 text-foreground/40" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 font-sans">
              Add new products to your kit
            </span>
          </div>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        {/* Face area group tiles */}
        <div className="flex flex-wrap justify-center gap-6">
          {displayedGroups.map((group) => {
            const Icon = groupIcons[group.key] ?? Circle;
            const filled = group.categories.filter(
              (cat) => filledSlots[cat]
            ).length;
            const total = group.categories.length;
            const isComplete = filled === total && total > 0;

            // Tally conflicts in this group from the compatibility map
            const groupConflicts = group.categories
              .map((cat) => filledSlots[cat])
              .filter((pid) => pid && compatibilityMap[pid] && !compatibilityMap[pid].isCompatible);
            const errorCount = groupConflicts.filter(
              (pid) => compatibilityMap[pid]?.severity === "error"
            ).length;
            const conflictCount = groupConflicts.length;
            const worstSeverity = errorCount > 0 ? "error" : conflictCount > 0 ? "warning" : null;

            return (
              <Link
                key={group.key}
                href={`/build/${group.key}`}
                className={`group flex w-full flex-col rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] ${
                  isComplete
                    ? "border-accent bg-accent text-white shadow-xl shadow-accent/20"
                    : "border-border/50 bg-white hover:border-accent"
                }`}
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                    isComplete ? "bg-white/20 text-white" : "bg-muted text-accent group-hover:bg-accent group-hover:text-white"
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 ${
                      isComplete ? "text-white/50" : "text-foreground/20"
                    }`}
                  />
                </div>

                <h2
                  className={`mb-1 text-xl font-bold tracking-tight font-serif ${
                    isComplete ? "text-white" : "text-foreground"
                  }`}
                >
                  {group.label}
                </h2>

                <p
                  className={`mb-6 text-xs font-sans font-medium uppercase tracking-widest ${
                    isComplete ? "text-white/60" : "text-foreground/40"
                  }`}
                >
                  {group.categories.length} {group.categories.length === 1 ? "category" : "categories"}
                </p>

                {/* Compatibility Badges */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {quotaExceeded && filled > 0 && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : "bg-foreground text-white"
                    }`}>
                      ! API Quota
                    </div>
                  )}

                  {!quotaExceeded && worstSeverity && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : worstSeverity === "error" ? "bg-red-500 text-white" : "bg-amber-400 text-foreground"
                    }`}>
                      {worstSeverity === "error" ? "✕" : "!"} {conflictCount} Conflict{conflictCount > 1 ? "s" : ""}
                    </div>
                  )}

                  {!quotaExceeded && !isAnalyzing && !worstSeverity && filled > 0 &&
                    group.categories
                      .filter((cat) => filledSlots[cat])
                      .every((cat) => analyzedIds.has(filledSlots[cat])) && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : "bg-green-50 text-green-600 border border-green-100"
                    }`}>
                      ✓ Compatible
                    </div>
                  )}

                  {isAnalyzing && filled > 0 && !worstSeverity && (
                     <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans animate-pulse ${
                      isComplete ? "bg-white/10 text-white/50" : "bg-muted text-foreground/30"
                    }`}>
                      ⚗ Analyzing…
                    </div>
                  )}
                </div>

                {/* Fill count bar */}
                <div className="mt-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.2em] font-sans ${
                        isComplete ? "text-white/60" : "text-foreground/30"
                      }`}
                    >
                      {filled} <span className="opacity-50">/</span> {total} selected
                    </span>
                  </div>
                  <div
                    className={`h-1.5 w-full rounded-full ${
                      isComplete ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isComplete ? "bg-white" : "bg-accent"
                      }`}
                      style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>


        {/* Makeup Recipe Card — Sophisticated Final Summary */}
        {recipeCard && !isAnalyzing && (
          <MakeupRecipeCard 
            recipe={recipeCard} 
            overallScore={overallScore} 
          />
        )}
      </div>
    </div>
  );
}
