"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { CategoryKey, Product, CategoryDefinition, CompatibilityMap } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots, readBuildProductCache } from "@/lib/buildSlots";
import { getQuizAutoFilters } from "@/lib/personalization";
import Link from "next/link";
import { X, Search, Star, Plus, LayoutGrid, List, Check, Loader2, ExternalLink } from "lucide-react";
import AddToBagCard from "@/components/AddToBagCard";
import { getProductColorInfo } from "@/lib/productColor";
import { getBestOfferForProduct, getDisplayName } from "@/lib/pricing";

type ViewMode = "tiles" | "list";

const PER_PAGE = 20;
// Max candidates to include in the compatibility batch call
const COMPAT_CANDIDATE_LIMIT = 20;

const SOURCE_LABELS: Record<string, string> = {
  chemist: "Ingredient Compatibility",
  artist: "Makeup Artistry",
  trend: "Trend Alignment",
  orchestrator: "System Analysis",
};

interface ProductPickerProps {
  categoryKey: CategoryKey;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export default function ProductPicker({ categoryKey, onSelect, onClose }: ProductPickerProps) {
  const category: CategoryDefinition = categoryMap[categoryKey];
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("tiles");
  const [products, setProducts] = useState<Product[]>([]);
  const [filterOptionsByKey, setFilterOptionsByKey] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInci, setManualInci] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");

  // Snapshot of already-built products for conflict name lookup
  const [productCache] = useState(() => readBuildProductCache());

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualInci) return;

    const mockProduct: Product = {
      id: `manual-${Date.now()}`,
      name: manualName,
      brand: manualBrand || "My Product",
      image: "/placeholder-product.jpg",
      category: categoryKey,
      stampScore: 0,
      prices: [],
      filters: {},
      inciIngredients: manualInci.split(",").map(i => i.trim()),
    };

    onSelect(mockProduct);
  };

  // Compatibility state
  const [compatibilityMap, setCompatibilityMap] = useState<CompatibilityMap>({});
  const [analyzedCandidateIds, setAnalyzedCandidateIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const compatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for reading current state inside IntersectionObserver callback (avoids stale closure)
  const stateRef = useRef({ hasMore, loadingMore, loading });
  stateRef.current = { hasMore, loadingMore, loading };

  // Callback ref — creates/destroys observer whenever the sentinel mounts/unmounts
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const { hasMore, loadingMore, loading } = stateRef.current;
          if (hasMore && !loadingMore && !loading) {
            setPage((p) => p + 1);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    observerRef.current.observe(node);
  }, []); // stable — never recreated

  useEffect(() => {
    const defaults = getQuizAutoFilters(category);
    if (Object.keys(defaults).length === 0) return;
    setActiveFilters((prev) => (Object.keys(prev).length > 0 ? prev : defaults));
  }, [category]);

  // Reset pagination whenever search/filters/category change
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    setError(null);
  }, [categoryKey, search, activeFilters]);

  // Fetch products — appends on page > 1, replaces on page === 1
  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;

    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    const fetchProducts = async () => {
      try {
        const filters: Record<string, string> = {};
        for (const [key, values] of Object.entries(activeFilters)) {
          if (values.size > 0) {
            filters[key] = Array.from(values).join(",");
          }
        }

        const data = await api.getProducts({
          category: categoryKey,
          search: search || undefined,
          filters,
          page,
          per_page: PER_PAGE,
        });

        if (cancelled) return;

        if (isFirstPage) {
          setProducts(data.items);
        } else {
          setProducts((prev) => [...prev, ...data.items]);
        }
        setHasMore(data.items.length === PER_PAGE);
      } catch (err) {
        if (!cancelled) {
          if (isFirstPage) {
            const message = err instanceof Error ? err.message : "Failed to load products";
            setError(message);
            setProducts([]);
          }
        }
      } finally {
        if (!cancelled) {
          if (isFirstPage) setLoading(false);
          else setLoadingMore(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [categoryKey, search, activeFilters, page]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const data = await api.getProductFilterProperties({ category: categoryKey });
        setFilterOptionsByKey(data.filters || {});
      } catch {
        setFilterOptionsByKey({});
      }
    };
    fetchFilterOptions();
  }, [categoryKey]);

  // ---------------------------------------------------------------------------
  // Compatibility check: existing build products vs. first N candidates
  // Only re-fires when the first-page candidates change (not on pagination)
  // ---------------------------------------------------------------------------
  const candidateIdsKey = useMemo(
    () => products.slice(0, COMPAT_CANDIDATE_LIMIT).map((p) => p.id).join(","),
    [products]
  );

  useEffect(() => {
    // Clear any pending debounce
    if (compatTimerRef.current) clearTimeout(compatTimerRef.current);

    // Existing build products for OTHER categories (not the one being picked)
    const existingIds = Object.entries(readBuildSlots())
      .filter(([cat]) => cat !== categoryKey)
      .map(([, id]) => id)
      .filter(Boolean);

    const candidateIds = candidateIdsKey ? candidateIdsKey.split(",") : [];
    const allIds = [...new Set([...existingIds, ...candidateIds])];

    // Need at least one existing product and one candidate to be meaningful
    if (existingIds.length === 0 || candidateIds.length === 0 || allIds.length < 2) {
      setCompatibilityMap({});
      setAnalyzedCandidateIds(new Set());
      setQuotaExceeded(false);
      return;
    }

    // Read beauty profile from localStorage for Artist Agent analysis
    const storedProfile = (() => {
      try {
        const raw = localStorage.getItem("beautyProfile");
        if (!raw) return null;
        const p = JSON.parse(raw);
        return {
          skin_tone: p.skinTone || null,
          undertone: p.undertone || null,
          skin_type: p.skinType || null,
          coverage: p.coverage || null,
          finish: p.finish || null,
          budget: p.budget || null,
        };
      } catch { return null; }
    })();

    // Debounce 500 ms so search typing doesn't spam the API
    compatTimerRef.current = setTimeout(() => {
      let cancelled = false;
      setIsAnalyzing(true);

      fetch("/api/v1/compatibility/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          build_id: "local-build",
          user_id: "local-user",
          product_ids: allIds,
          beauty_profile: storedProfile,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;

          // Only surface badges on CANDIDATE products — not existing build products
          const candidateSet = new Set(candidateIds);
          const map: CompatibilityMap = {};
          for (const [pid, raw] of Object.entries(
            (data.compatibility_map ?? {}) as Record<string, { is_compatible: boolean; reason: string; severity: "error" | "warning"; source_agent: string; conflicting_product_ids?: string[]; debug_trace?: string[] }>
          )) {
            if (!candidateSet.has(pid)) continue;
            map[pid] = {
              isCompatible: raw.is_compatible,
              reason: raw.reason,
              reasons: [],
              severity: raw.severity,
              sourceAgent: raw.source_agent,
              conflictingProductIds: raw.conflicting_product_ids ?? [],
              debugTrace: raw.debug_trace ?? [],
            };
          }
          setCompatibilityMap(map);
          setAnalyzedCandidateIds(new Set(candidateIds));
          setQuotaExceeded((data.errors ?? []).includes("quota_exceeded"));
        })
        .catch(() => {
          if (!cancelled) {
            setCompatibilityMap({});
            setQuotaExceeded(false);
          }
        })
        .finally(() => {
          if (!cancelled) setIsAnalyzing(false);
        });

      return () => {
        cancelled = true;
      };
    }, 500);

    return () => {
      if (compatTimerRef.current) clearTimeout(compatTimerRef.current);
    };
    // Re-run only when the set of first-page candidates changes, not on pagination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIdsKey, categoryKey]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const compatA = compatibilityMap[a.id];
      const compatB = compatibilityMap[b.id];

      // Get "weight" for sorting: 0=Compatible, 1=Warning, 2=Error
      const getWeight = (c?: any) => {
        if (!c) return 0;
        if (c.isCompatible) return 0;
        return c.severity === "error" ? 2 : 1;
      };

      const weightA = getWeight(compatA);
      const weightB = getWeight(compatB);

      if (weightA !== weightB) return weightA - weightB;
      
      // Secondary sort: stamp score descending
      return b.stampScore - a.stampScore;
    });
  }, [products, compatibilityMap]);

  const filtered = sortedProducts;

  const displayedFilters = useMemo(() => {
    return category.filters.map((filter) => {
      const options = filterOptionsByKey[filter.key];
      if (!options || options.length === 0) return filter;
      return { ...filter, options };
    });
  }, [category.filters, filterOptionsByKey]);

  const toggleFilter = (filterKey: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[filterKey] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[filterKey] = set;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-2xl animate-pop-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-white/70 px-8 py-6 backdrop-blur-xl">
        <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Inventory Browser</p>
            <h2 className="text-2xl font-bold font-serif leading-none">Choose {category.label}</h2>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all font-sans ${showManualEntry ? "bg-accent text-white" : "bg-muted text-foreground/40 hover:bg-muted/80"}`}
            >
                {showManualEntry ? "Back to Catalog" : "Add by Ingredients"}
            </button>
            <button 
                onClick={onClose} 
                className="group flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-all hover:bg-accent hover:text-white" 
                aria-label="Close"
            >
              <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showManualEntry ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold font-serif text-foreground">Audit Your Kit</h3>
                    <p className="text-sm text-foreground/40 font-sans">Can&apos;t find your product? Paste the ingredient list (INCI) from the packaging to check for stability and pilling risks.</p>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 font-sans px-1">Brand</label>
                            <input 
                                type="text"
                                placeholder="e.g. Rare Beauty"
                                value={manualBrand}
                                onChange={e => setManualBrand(e.target.value)}
                                className="w-full rounded-2xl border border-border/50 bg-white px-5 py-4 text-sm font-medium outline-none focus:border-accent transition-all font-sans"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 font-sans px-1">Product Name</label>
                            <input 
                                type="text"
                                placeholder="e.g. Soft Pinch Blush"
                                value={manualName}
                                onChange={e => setManualName(e.target.value)}
                                required
                                className="w-full rounded-2xl border border-border/50 bg-white px-5 py-4 text-sm font-medium outline-none focus:border-accent transition-all font-sans"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 font-sans px-1">Ingredients (INCI)</label>
                        <textarea 
                            placeholder="Paste ingredient list here (comma separated)..."
                            value={manualInci}
                            onChange={e => setManualInci(e.target.value)}
                            required
                            className="w-full h-48 rounded-3xl border border-border/50 bg-white px-6 py-5 text-sm font-medium outline-none focus:border-accent transition-all font-sans resize-none"
                        />
                    </div>

                    <button 
                        type="submit"
                        className="w-full rounded-2xl bg-foreground py-5 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-black/5 hover:bg-accent hover:shadow-accent/20 transition-all font-sans active:scale-[0.98]"
                    >
                        Verify Compatibility & Add
                    </button>
                </form>
            </div>
        </div>
      ) : (
        <>
          {/* Search bar + view toggle */}
      <div className="flex items-center gap-4 border-b border-border/50 bg-white/50 px-8 py-4 backdrop-blur-sm">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/50 bg-white px-5 py-3 shadow-sm transition-all focus-within:border-accent focus-within:shadow-lg focus-within:shadow-accent/5">
          <Search className="h-4 w-4 text-foreground/20" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-foreground/30 font-sans"
          />
        </div>

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 animate-pulse">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent/50 font-sans">
                ⚗ Analyzing…
            </span>
          </div>
        )}
        
        {quotaExceeded && !isAnalyzing && (
          <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 shadow-lg shadow-black/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white font-sans">
                ! API Quota Met
            </span>
          </div>
        )}

        <div className="flex items-center rounded-2xl border border-border/50 bg-white p-1 shadow-sm overflow-hidden">
          <button
            onClick={() => setViewMode("tiles")}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${viewMode === "tiles" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-foreground/30 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${viewMode === "list" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-foreground/30 hover:bg-muted"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body: sidebar + product list */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-border/50 bg-white/30 px-8 py-8 md:block">
          <div className="mb-8 border-b border-border/30 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground font-sans">Filters</h3>
          </div>
          {displayedFilters
            .filter((f) => f.type === "checkbox" && f.options && f.options.length > 0)
            .map((filter) => (
              <div key={filter.key} className="mb-8">
                <h4 className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/30 font-sans">
                  {filter.label}
                </h4>
                <div className="flex flex-col gap-3">
                  {filter.options!.map((opt) => {
                    const active = activeFilters[filter.key]?.has(opt) ?? false;
                    return (
                      <label key={opt} className="group flex cursor-pointer items-center gap-3 text-sm transition-colors hover:text-accent font-sans">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${active ? "border-accent bg-accent text-white shadow-lg shadow-accent/20" : "border-border/50 bg-white group-hover:border-accent"}`}>
                            {active && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFilter(filter.key, opt)}
                          className="hidden"
                        />
                        <span className={`text-sm font-medium ${active ? "text-foreground" : "text-foreground/50"}`}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
        </aside>

        {/* Product list / tiles */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-8 w-8 animate-spin text-foreground/30" />
              <p className="mt-4 text-sm text-foreground/40">Loading products...</p>
            </div>
          ) : (
            <>
              {filtered.length > 0 ? (
                viewMode === "list" ? (
                  <div className="px-8 py-6">
                    <table className="w-full text-sm">
                        <thead className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                        <tr>
                            <th className="pb-6 pl-4">Product Details</th>
                            <th className="hidden pb-6 sm:table-cell">Score</th>
                            <th className="pb-6 text-right">Estimate</th>
                            <th className="pb-6 text-right pr-4">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                        {filtered.map((product) => {
                            const colorInfo = getProductColorInfo(product);
                            const compat = compatibilityMap[product.id];
                            const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                            const isError = hasConflict && compat.severity === "error";
                            const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;

                            return (
                            <tr key={product.id} className="group transition-all duration-500 ease-out hover:bg-muted/40">
                                <td className="py-6 pl-4">
                                <div className="flex items-center gap-6">
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted p-2 will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110">
                                    <img
                                        // eslint-disable-next-line @next/next/no-img-element
                                        src={product.image || "/placeholder-product.jpg"}
                                        alt={getDisplayName(product.name)}
                                        className="h-full w-full object-contain"
                                        loading="lazy"
                                        onError={(e) => {
                                        e.currentTarget.src = "/placeholder-product.jpg";
                                        }}
                                    />
                                    </div>
                                    <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{product.brand}</p>
                                    <Link href={`/product/${product.id}`} className="block font-semibold text-foreground font-serif text-base hover:text-accent transition-colors">{product.name}</Link>

                                    <div className="flex items-center gap-3 pt-1">
                                        <p className="inline-flex items-center gap-1.5 text-[10px] text-foreground/40 font-sans">
                                            <span
                                            className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                                            style={{ backgroundColor: colorInfo.hex }}
                                            title={colorInfo.label}
                                            />
                                            {colorInfo.label}
                                        </p>

                                        {/* Compatibility badges */}
                                        {isCompatible && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-green-600 border border-green-100 font-sans transition-all duration-500 group-hover:bg-green-100">✓ Compatible</span>
                                        )}
                                        {quotaExceeded && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white font-sans transition-all duration-500 group-hover:bg-accent">! API Quota</span>
                                        )}
                                        {hasConflict && (
                                            <div className="group/tooltip relative inline-block cursor-default">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest font-sans transition-all duration-500 ${isError ? "bg-red-500 text-white" : "bg-amber-100 text-amber-800"}`}>
                                                    {isError ? "✕ Conflict" : "! Warning"}
                                                </span>
                                                <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-border/50 bg-white p-4 shadow-2xl opacity-0 translate-y-1 scale-95 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 group-hover/tooltip:scale-100">
                                                    {/* Source agent tag */}
                                                    <p className="mb-2 text-[7px] font-bold uppercase tracking-widest text-foreground/40 font-sans">
                                                        {SOURCE_LABELS[compat.sourceAgent] || "Expert Analysis"}
                                                    </p>
                                                    {compat.conflictingProductIds.length > 0 && (
                                                        <div className="mb-2 pb-2 border-b border-border/20">
                                                            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-foreground/40 font-sans">Conflicts with</p>
                                                            {compat.conflictingProductIds.map((id) => (
                                                                <p key={id} className="text-[10px] font-bold text-foreground font-sans leading-snug">{getDisplayName(productCache[id]?.name ?? "another product")}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-[10px] font-medium leading-relaxed text-foreground font-sans">{compat.reason}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                </div>
                                </td>
                                <td className="hidden py-6 sm:table-cell">
                                <div className="flex items-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 fill-accent text-accent transition-transform duration-500 group-hover:scale-125" />
                                    <span className="font-bold text-foreground font-sans">{product.stampScore}</span>
                                </div>
                                </td>
                                <td className="py-6 text-right font-bold text-foreground font-sans text-lg tracking-tight">
                                ${(getBestOfferForProduct(product)?.price ?? 0).toFixed(2)}
                                </td>
                                <td className="py-6 text-right pr-4">
                                <button
                                    onClick={() => onSelect(product)}
                                    className="group/btn inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 font-sans"
                                >
                                    <Plus className="h-3.5 w-3.5 transition-transform duration-500 group-hover/btn:rotate-90" /> Add
                                </button>
                                </td>
                            </tr>
                            );
                        })}
                        </tbody>
                    </table>
                  </div>
                ) : (
                  // Tile view — wrap each AddToBagCard with a compatibility overlay
                  <div className="grid grid-cols-2 gap-6 p-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((product) => {
                      const compat = compatibilityMap[product.id];
                      const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                      const isError = hasConflict && compat.severity === "error";
                      const showQuota = quotaExceeded;
                      const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;

                      return (
                        <div
                          key={product.id}
                          className={`group relative flex aspect-[3/5] flex-col overflow-hidden rounded-3xl border border-border/50 bg-white transition-all duration-300 will-change-transform ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(232,75,138,0.15)]`}
                        >
                          <div className="relative h-[70%] overflow-hidden bg-muted/30 p-4 transition-colors duration-500 group-hover:bg-muted/50">
                            <img
                              // eslint-disable-next-line @next/next/no-img-element
                              src={product.image || "/placeholder-product.jpg"}
                              alt={product.name}
                              className="h-full w-full object-contain will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-product.jpg";
                              }}
                            />
                            
                            {/* Compatibility Overlays */}
                            <div className="absolute inset-x-2 top-2 z-10 flex flex-col gap-1">
                                {isCompatible && (
                                    <div className="animate-slide-in rounded-full bg-green-50/90 px-2 py-1 text-[7px] font-bold uppercase tracking-widest text-green-600 border border-green-100 backdrop-blur-sm shadow-sm">✓ Compatible</div>
                                )}
                                {showQuota && (
                                    <div className="animate-slide-in rounded-full bg-foreground/90 px-2 py-1 text-[7px] font-bold uppercase tracking-widest text-white backdrop-blur-sm shadow-sm">! API Quota</div>
                                )}
                                {hasConflict && (
                                    <div className="group/tooltip relative inline-block cursor-default">
                                        <div className={`animate-slide-in rounded-full px-2 py-1 text-[7px] font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm ${isError ? "bg-red-500/90 text-white" : "bg-amber-100/90 text-amber-800"}`}>
                                            {isError ? "✕ Conflict" : "! Warning"}
                                        </div>
                                        <div className="pointer-events-none absolute inset-x-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border/50 bg-white p-4 shadow-2xl opacity-0 translate-y-1 scale-95 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 group-hover/tooltip:scale-100">
                                            {/* Source agent tag */}
                                            <p className="mb-2 text-[7px] font-bold uppercase tracking-widest text-foreground/40 font-sans">
                                                {SOURCE_LABELS[compat.sourceAgent] || "Expert Analysis"}
                                            </p>
                                            {compat.conflictingProductIds.length > 0 && (
                                                <div className="mb-2 pb-2 border-b border-border/20">
                                                    <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-foreground/40 font-sans">Conflicts with</p>
                                                    {compat.conflictingProductIds.map((id) => (
                                                        <p key={id} className="text-[10px] font-bold text-foreground font-sans leading-snug">{getDisplayName(productCache[id]?.name ?? "another product")}</p>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-[10px] font-medium leading-snug text-foreground font-sans">{compat.reason}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[9px] font-bold text-foreground backdrop-blur-sm shadow-sm font-sans">
                                <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5 fill-accent text-accent" /> {product.stampScore}</span>
                            </div>
                            <Link
                              href={`/product/${product.id}`}
                              className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-foreground/40 backdrop-blur-sm shadow-sm transition-all hover:bg-accent hover:text-white"
                              title="View details"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>

                          <div className="flex flex-1 flex-col gap-1 p-4">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-accent font-sans">
                                  {product.brand}
                                </p>
                                <Link href={`/product/${product.id}`} className="block">
                                  <h3 className="line-clamp-2 text-xs font-semibold leading-tight font-serif text-foreground hover:text-accent transition-colors">
                                    {product.name}
                                  </h3>
                                </Link>
                            </div>
                            
                            <div className="mt-auto pt-2 flex flex-col gap-2">
                                <p className="text-sm font-bold text-foreground font-sans tracking-tight">
                                    ${(getBestOfferForProduct(product)?.price ?? 0).toFixed(2)}
                                </p>
                                
                                <button
                                    onClick={() => onSelect(product)}
                                    className="group/btn inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[9px] font-bold uppercase tracking-widest text-white transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-accent hover:shadow-lg hover:shadow-accent/20 hover:-translate-y-0.5 font-sans"
                                >
                                    <Plus className="h-3 w-3 transition-transform duration-500 group-hover/btn:rotate-90" /> Add
                                </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <p className="py-16 text-center text-sm text-foreground/40">
                  {search
                    ? `No products found for "${search}"`
                    : "No products match the selected filters."}
                </p>
              )}

              {/* Infinite scroll sentinel — IntersectionObserver fires when this enters view */}
              <div ref={sentinelRef} className="h-px" />
              {loadingMore && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <p className="py-6 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/20">
                  All products loaded
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
