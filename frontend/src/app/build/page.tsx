"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BeautyProfile, ToolboxSlot, CategoryKey, Product } from "@/types";
import Toolbox from "@/components/Toolbox";
import ProductPicker from "@/components/ProductPicker";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots, saveBuildSlot, removeBuildSlot } from "@/lib/buildSlots";
import { ExternalLink, X, Eye } from "lucide-react";

const mainCategories: CategoryKey[] = [
  "foundation",
  "concealer",
  "powder",
  "blush",
  "eyeshadow",
  "mascara",
  "lipstick",
];

export default function BuildPage() {
  const router = useRouter();
<<<<<<< Updated upstream
  const [profile, setProfile] = useState<BeautyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<ToolboxSlot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
=======
  const [filledSlots] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    return readBuildSlots();
  });
  const [isLoadingQuizRedirect, setIsLoadingQuizRedirect] = useState(false); // New state for quiz redirect loading
>>>>>>> Stashed changes

  useEffect(() => {
    const saved = localStorage.getItem("beautyProfile");
    if (!saved) {
      setIsLoadingQuizRedirect(true); // Indicate loading while redirecting
      router.push("/build/quiz");
    }
<<<<<<< Updated upstream
    setProfile(JSON.parse(saved));

    // Restore saved slots from localStorage
    const savedSlots = readBuildSlots();

    // Build initial slots, then hydrate saved products
    const initialSlots: ToolboxSlot[] = mainCategories.map((category) => ({
      category,
      product: null,
    }));

    // Fetch saved product data before showing the page
    const entries = Object.entries(savedSlots).filter(
      ([cat]) => mainCategories.includes(cat as CategoryKey)
    );
    if (entries.length > 0) {
      Promise.all(
        entries.map(async ([cat, productId]) => {
          try {
            const product = await api.getProduct(productId);
            return { category: cat as CategoryKey, product };
          } catch {
            return null;
          }
        })
      ).then((results) => {
        setSlots(
          initialSlots.map((slot) => {
            const match = results.find(
              (r) => r && r.category === slot.category
            );
            return match ? { ...slot, product: match.product } : slot;
          })
        );
        setLoading(false);
      });
    } else {
      setSlots(initialSlots);
      setLoading(false);
    }
=======
  // eslint-disable-next-line react-hooks/exhaustive-deps
>>>>>>> Stashed changes
  }, [router]);

  const handleSelectProduct = (category: CategoryKey) => {
    setSelectedCategory(category);
  };

  const handleProductSelected = (product: Product) => {
    if (selectedCategory) {
      saveBuildSlot(selectedCategory, product.id);
    }
    setSlots((prev) =>
      prev.map((slot) =>
        slot.category === selectedCategory ? { ...slot, product } : slot
      )
    );
    setSelectedCategory(null);
  };

  const handleRemoveProduct = (category: CategoryKey) => {
    removeBuildSlot(category);
    setSlots((prev) =>
      prev.map((slot) =>
        slot.category === category ? { ...slot, product: null } : slot
      )
    );
  };

  const getLowestPrice = (product: Product) => {
    const sorted = [...product.prices].sort((a, b) => a.price - b.price);
    return sorted[0];
  };

  if (isLoadingQuizRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold uppercase tracking-tight">
            Build Your Look
          </h1>
          <p className="text-sm text-neutral-500">
            Select products for each category to create your perfect makeup toolbox
          </p>
        </div>

        {/* Category slots */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const best = slot.product ? getLowestPrice(slot.product) : null;
            return (
              <div
                key={slot.category}
                className={`border p-6 transition-all ${
                  slot.product ? "border-accent/30 bg-muted" : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-foreground/40">
                    {categoryMap[slot.category]?.label || slot.category}
                  </div>
                  {slot.product && (
                    <button
                      onClick={() => handleRemoveProduct(slot.category)}
                      className="text-foreground/30 transition-colors hover:text-red-500"
                      title="Remove product"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {slot.product ? (
                  <div>
                    <div className="mb-3 h-28 overflow-hidden rounded-lg bg-muted">
                      <img
                        src={slot.product.image || "/placeholder-product.jpg"}
                        alt={slot.product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-product.jpg";
                        }}
                      />
                    </div>
                    <div className="mb-1 text-sm font-semibold">{slot.product.name}</div>
                    <div className="mb-3 text-xs text-foreground/50">{slot.product.brand}</div>
                    {best && (
                      <div className="mb-3 text-sm font-bold text-accent">
                        ${best.price.toFixed(2)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Link
                        href={`/product/${slot.product.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1 border border-border px-3 py-2 text-xs font-medium transition-all hover:border-foreground"
                      >
                        <Eye className="h-3 w-3" /> Prices
                      </Link>
                      {best && (
                        <a
                          href={best.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-1 bg-accent px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-110"
                        >
                          <ExternalLink className="h-3 w-3" /> Buy
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectProduct(slot.category)}
                    className="w-full py-2 text-sm text-foreground/40 transition-colors hover:text-accent"
                  >
                    + Add product
                  </button>
                )}
              </div>
=======
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
              Personalized Toolbox
            </p>
          </div>
          <h1 className="mb-4 text-4xl font-bold font-serif">
            Build Your Look
          </h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-foreground/60 font-sans">
              Curate your essentials across 5 key face areas. Our AI chemist will analyze compatibility in real-time.
            </p>
            <Link
              href="/build/quiz"
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent transition-all hover:text-pink-deep font-sans"
            >
              Edit Beauty Profile &rarr;
            </Link>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mb-16 rounded-3xl bg-white p-8 shadow-xl shadow-accent/5 border border-border/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                Curating Progress
              </span>
              <p className="text-2xl font-bold font-sans">
                {Math.round(totalCategories > 0 ? (totalFilled / totalCategories) * 100 : 0)}% <span className="text-sm font-medium text-foreground/40 font-sans">Complete</span>
              </p>
            </div>
            <div className="text-right">
               <span className="text-sm font-bold font-sans text-accent">
                {totalFilled} <span className="text-foreground/20">/</span> {totalCategories}
              </span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${totalCategories > 0 ? (totalFilled / totalCategories) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Face area group tiles */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categoryGroups.map((group) => {
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
                className={`group flex flex-col rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 ${
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
>>>>>>> Stashed changes
            );
          })}
        </div>
        
        <Toolbox slots={slots} />

        {/* Product picker modal */}
        {selectedCategory && (
          <ProductPicker
            categoryKey={selectedCategory}
            onSelect={handleProductSelected}
            onClose={() => setSelectedCategory(null)}
          />
        )}
      </div>
    </div>
  );
}
