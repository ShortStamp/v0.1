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
import { getDisplayName, getDisplayBrand, getBestOfferForProduct } from "@/lib/pricing";
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
  ShoppingBag,
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
  const tilesRef = useRef<HTMLDivElement>(null);
  const [buyAllOpen, setBuyAllOpen] = useState(false);
  const buyAllRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (kitRef.current && !kitRef.current.contains(e.target as Node)) {
        setKitSearchOpen(false);
      }
      if (buyAllRef.current && !buyAllRef.current.contains(e.target as Node)) {
        setBuyAllOpen(false);
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
            Build Your Kit. Scan for Conflicts.
          </h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-foreground/60 font-sans">
              Every product is checked against your skin profile and for chemical incompatibilities with your other picks.
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
        <div className="mb-8 rounded-2xl bg-white px-6 py-5 shadow-md shadow-accent/5 border border-border/50">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground font-sans">What do you already own?</span>
              <span className="text-[10px] text-foreground/50 font-sans">— we&apos;ll flag conflicts as you browse</span>
            </div>
            {ownedProducts.length > 0 && (
              <div className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40 font-sans">
                {ownedProducts.length} owned
              </div>
            )}
          </div>

          {/* Search input + dropdown */}
          <div ref={kitRef} className="relative mb-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-2.5 shadow-sm transition-all focus-within:border-foreground">
              <Search className="h-4 w-4 shrink-0 text-foreground/30" />
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
                            offerUrl: getBestOfferForProduct(product)?.url,
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
          {ownedProducts.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {ownedProducts.map((o) => {
                  const buyUrl = o.offerUrl || `/product/${o.id}`;
                  return (
                    <div
                      key={o.id}
                      className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted pl-2 pr-1 py-1"
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
                      <span className="max-w-[100px] truncate text-[10px] font-bold font-sans text-foreground/70">
                        {o.name}
                      </span>
                      <a
                        href={buyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-white transition-colors hover:bg-accent"
                        title={`Buy ${o.name}`}
                      >
                        <ShoppingBag className="h-2.5 w-2.5" />
                      </a>
                      <button
                        onClick={() => {
                          removeOwnedProduct(o.id);
                          setOwnedProducts(readOwnedProducts());
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-foreground/10 hover:text-foreground"
                        aria-label={`Remove ${o.name}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Buy All dropdown */}
              <div ref={buyAllRef} className="relative mt-3 inline-block">
                <button
                  onClick={() => setBuyAllOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-accent font-sans"
                >
                  <ShoppingBag className="h-3 w-3" />
                  Buy All ({ownedProducts.length})
                </button>

                {buyAllOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-border/50 bg-white shadow-xl shadow-black/10">
                    <p className="border-b border-border/30 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40 font-sans">
                      Buy individually
                    </p>
                    {ownedProducts.map((o) => (
                      <a
                        key={o.id}
                        href={o.offerUrl || `/product/${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-muted p-1">
                          <img
                            // eslint-disable-next-line @next/next/no-img-element
                            src={o.image || "/placeholder-product.jpg"}
                            alt={o.name}
                            className="h-full w-full object-contain"
                            onError={(e) => { e.currentTarget.src = "/placeholder-product.jpg"; }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-accent font-sans">{o.brand}</p>
                          <p className="truncate text-xs font-semibold text-foreground font-sans">{o.name}</p>
                        </div>
                        <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-foreground/30" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Divider: owned → new */}
        <div className="mb-8 flex items-center gap-6">
          <div className="h-px flex-1 bg-border/50" />
          <button
            onClick={() => tilesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex items-center gap-3 rounded-full border border-border/60 bg-white px-5 py-2.5 shadow-sm transition-all hover:border-foreground hover:shadow-md"
          >
            <ArrowDown className="h-4 w-4 text-foreground/40" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 font-sans">
              Add new products to your kit
            </span>
          </button>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        {/* Face area group tiles */}
        <div ref={tilesRef} className="flex flex-wrap justify-center gap-6">
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
