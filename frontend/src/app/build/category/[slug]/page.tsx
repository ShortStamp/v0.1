"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryKey, Product, CategoryDefinition, CompatibilityMap } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots, saveBuildSlot, saveBuildProductToCache, readBuildProductCache } from "@/lib/buildSlots";
import { analytics } from "@/lib/analytics";
import { getQuizAutoFilters } from "@/lib/personalization";
import Link from "next/link";
import { ArrowLeft, Search, Star, Plus, LayoutGrid, List, Check, Loader2, ExternalLink } from "lucide-react";
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";
import { getProductColorInfo } from "@/lib/productColor";
import { ConflictBadge } from "@/components/DebugTrace";

type ViewMode = "tiles" | "list";
const PER_PAGE = 20;
const COMPAT_CANDIDATE_LIMIT = 20;

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryKey = params.slug as CategoryKey;
  const category: CategoryDefinition | undefined = categoryMap[categoryKey];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterOptionsByKey, setFilterOptionsByKey] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("tiles");
  const [sort, setSort] = useState("stamp_score_desc");
  const [hasQuizFilters, setHasQuizFilters] = useState(false);

  // Snapshot of already-built products for conflict name lookup
  const [productCache] = useState(() => readBuildProductCache());

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
    if (!category) return;
    const defaults = getQuizAutoFilters(category);
    if (Object.keys(defaults).length === 0) return;
    setHasQuizFilters(true);
    setActiveFilters((prev) => (Object.keys(prev).length > 0 ? prev : defaults));
  }, [category]);

  // Reset pagination whenever search/filters/category/sort change
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    setLoadError(false);
  }, [categoryKey, search, activeFilters, sort]);

  // Fetch products — appends on page > 1, replaces on page === 1
  useEffect(() => {
    if (!categoryKey) return;
    let cancelled = false;
    const isFirstPage = page === 1;

    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    const fetchProducts = async () => {
      try {
        const filters: Record<string, string> = {};
        for (const [key, values] of Object.entries(activeFilters)) {
          if (values.size > 0) filters[key] = Array.from(values).join(",");
        }

        let data = await api.getProducts({
          category: categoryKey,
          search: search || undefined,
          filters,
          sort,
          page,
          per_page: PER_PAGE,
        });

        // Page 1 only: if filters yield no results, retry without non-brand filters
        if (
          isFirstPage &&
          data.items.length === 0 &&
          Object.keys(filters).some((k) => k !== "brand")
        ) {
          const brandOnly: Record<string, string> = {};
          if (filters.brand) brandOnly.brand = filters.brand;
          data = await api.getProducts({
            category: categoryKey,
            search: search || undefined,
            filters: brandOnly,
            sort,
            page: 1,
            per_page: PER_PAGE,
          });
        }

        if (cancelled) return;

        if (isFirstPage) {
          setProducts(data.items);
        } else {
          setProducts((prev) => [...prev, ...data.items]);
        }
        setHasMore(data.items.length === PER_PAGE);
      } catch {
        if (!cancelled && isFirstPage) {
          setProducts([]);
          setLoadError(true);
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
  }, [categoryKey, search, activeFilters, sort, page]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!categoryKey) return;
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
    if (compatTimerRef.current) clearTimeout(compatTimerRef.current);

    const existingIds = Object.entries(readBuildSlots())
      .filter(([cat]) => cat !== categoryKey)
      .map(([, id]) => id)
      .filter(Boolean);

    const candidateIds = candidateIdsKey ? candidateIdsKey.split(",") : [];
    const allIds = [...new Set([...existingIds, ...candidateIds])];

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
          const candidateSet = new Set(candidateIds);
          const map: CompatibilityMap = {};
          for (const [pid, raw] of Object.entries(
            (data.compatibility_map ?? {}) as Record<string, { is_compatible: boolean; reason: string; severity: string; source_agent: string; conflicting_product_ids?: string[]; debug_trace?: string[] }>
          )) {
            if (!candidateSet.has(pid)) continue;
            map[pid] = {
              isCompatible: raw.is_compatible,
              reason: raw.reason,
              reasons: [],
              severity: raw.severity as "error" | "warning",
              sourceAgent: raw.source_agent,
              conflictingProductIds: raw.conflicting_product_ids ?? [],
              debugTrace: raw.debug_trace ?? [],
            };
          }
          setCompatibilityMap(map);
          setAnalyzedCandidateIds(candidateSet);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIdsKey, categoryKey]);

  const filtered = useMemo(() => products, [products]);

  const displayedFilters = useMemo(() => {
    if (!category) return [];
    return category.filters.map((filter) => {
      const options = filterOptionsByKey[filter.key];
      if (!options || options.length === 0) return filter;
      return { ...filter, options };
    });
  }, [category, filterOptionsByKey]);

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

  const lowestPrice = (p: Product) => getBestOfferForProduct(p)?.price ?? 0;

  const currentProductId: string | null = (() => {
    const slots = readBuildSlots();
    return slots[categoryKey] || null;
  })();

  const selectProduct = (product: Product) => {
    saveBuildSlot(categoryKey, product.id);
    saveBuildProductToCache(product.id, product);
    analytics.productAddedToBuild({
      product_id: product.id,
      product_name: product.name,
      product_brand: product.brand ?? "",
      category: categoryKey,
    });
    router.push("/build");
  };

  if (!category) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-foreground/40">Category not found.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-2xl animate-pop-in">
      {/* Header */}
      <div className="flex items-center gap-6 border-b border-border/50 bg-white/70 px-8 py-6 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="group flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-all hover:bg-accent hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Step 2: Selection</p>
            <h1 className="text-2xl font-bold font-serif leading-none">
                Choose {category.label}
            </h1>
        </div>
      </div>

      {/* Personalization banner */}
      {hasQuizFilters && (
        <div className="border-b border-border/30 bg-accent/5 px-8 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
            Personalized curation based on your beauty profile
          </p>
        </div>
      )}

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

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-11 rounded-2xl border border-border/50 bg-white px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground shadow-sm outline-none transition-all hover:border-accent focus:border-accent font-sans cursor-pointer"
          aria-label="Sort products"
        >
          <option value="stamp_score_desc">Best Match</option>
          <option value="price_asc">Best Price</option>
          <option value="name_asc">A–Z</option>
        </select>

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
              <p className="mt-2 text-[10px] text-foreground/20 font-sans">First load may take a moment</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <p className="text-sm text-foreground/50 font-sans">Couldn&apos;t reach the server. It may be warming up.</p>
              <button
                onClick={() => {
                  setLoadError(false);
                  setPage(1);
                  setProducts([]);
                  setHasMore(true);
                }}
                className="rounded-xl bg-foreground px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-accent font-sans"
              >
                Try Again
              </button>
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
                            const isCurrentlySelected = currentProductId === product.id;
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
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{getDisplayBrand(product.brand)}</p>
                                    <Link href={`/product/${product.id}`} className="block font-semibold text-foreground font-serif text-base hover:text-accent transition-colors">{getDisplayName(product.name)}</Link>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {/* ChemAI compatibility badges */}
                                        {isCompatible && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-green-600 border border-green-100 font-sans transition-all duration-500 group-hover:bg-green-100">✓ Compatible</span>
                                        )}
                                        {quotaExceeded && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white font-sans transition-all duration-500 group-hover:bg-accent">! API Quota</span>
                                        )}
                                        {hasConflict && (
                                            <ConflictBadge
                                                compat={compat}
                                                resolveName={(id) => getDisplayName(productCache[id]?.name ?? "another product")}
                                                position="above"
                                            />
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
                                {formatPrice(lowestPrice(product))}
                                </td>
                                <td className="py-6 text-right pr-4">
                                {isCurrentlySelected ? (
                                    <div className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-accent font-sans">
                                    <Check className="h-3.5 w-3.5 stroke-[3]" /> Selected
                                    </div>
                                ) : (
                                    <button
                                    onClick={() => selectProduct(product)}
                                    className="group/btn inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 font-sans"
                                    >
                                    <Plus className="h-3.5 w-3.5 transition-transform duration-500 group-hover/btn:rotate-90" /> Add
                                    </button>
                                )}
                                </td>
                            </tr>
                            );
                        })}
                        </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6 p-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((product) => {
                      const isCurrentlySelected = currentProductId === product.id;
                      const compat = compatibilityMap[product.id];
                      const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                      const isError = hasConflict && compat.severity === "error";
                      const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;
                      return (
                        <div
                          key={product.id}
                          className={`group relative flex aspect-[3/5] flex-col overflow-hidden rounded-3xl border will-change-transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(232,75,138,0.15)] ${
                            isCurrentlySelected
                              ? "border-accent bg-white shadow-xl shadow-accent/10"
                              : "border-border/50 bg-white hover:border-accent shadow-sm"
                          }`}
                        >
                          <div className="relative h-[70%] overflow-hidden bg-muted/30 p-4 transition-colors duration-500 group-hover:bg-muted/50">
                            <img
                              // eslint-disable-next-line @next/next/no-img-element
                              src={product.image || "/placeholder-product.jpg"}
                              alt={getDisplayName(product.name)}
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
                                {quotaExceeded && (
                                    <div className="animate-slide-in rounded-full bg-foreground/90 px-2 py-1 text-[7px] font-bold uppercase tracking-widest text-white backdrop-blur-sm shadow-sm">! API Quota</div>
                                )}
                                {hasConflict && (
                                    <ConflictBadge
                                        compat={compat}
                                        resolveName={(id) => getDisplayName(productCache[id]?.name ?? "another product")}
                                        position="below"
                                    />
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
                                  {getDisplayBrand(product.brand)}
                                </p>
                                <Link href={`/product/${product.id}`} className="block">
                                  <h3 className="line-clamp-2 text-xs font-semibold leading-tight font-serif text-foreground hover:text-accent transition-colors">
                                    {getDisplayName(product.name)}
                                  </h3>
                                </Link>
                            </div>
                            
                            <div className="mt-auto pt-2 flex flex-col gap-2">
                                <p className="text-sm font-bold text-foreground font-sans tracking-tight">
                                    {formatPrice(lowestPrice(product))}
                                </p>
                                
                                {isCurrentlySelected ? (
                                    <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent bg-accent/5 py-2 text-[9px] font-bold uppercase tracking-widest text-accent font-sans">
                                        <Check className="h-3 w-3 stroke-[3]" /> Selected
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => selectProduct(product)}
                                        className="group/btn inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[9px] font-bold uppercase tracking-widest text-white transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-accent hover:shadow-lg hover:shadow-accent/20 hover:-translate-y-0.5 font-sans"
                                    >
                                        <Plus className="h-3 w-3 transition-transform duration-500 group-hover/btn:rotate-90" /> Add
                                    </button>
                                )}
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
    </div>
  );
}
