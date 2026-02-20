"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryKey, Product, CategoryDefinition, CompatibilityMap } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots, saveBuildSlot, saveBuildProductToCache } from "@/lib/buildSlots";
import { getQuizAutoFilters } from "@/lib/personalization";
import { ArrowLeft, Search, Star, Plus, LayoutGrid, List, Check, Loader2 } from "lucide-react";
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";

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
  const [filterOptionsByKey, setFilterOptionsByKey] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("tiles");
  const [hasQuizFilters, setHasQuizFilters] = useState(false);

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

  // Reset pagination whenever search/filters/category change
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
  }, [categoryKey, search, activeFilters]);

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
        if (!cancelled && isFirstPage) setProducts([]);
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
            (data.compatibility_map ?? {}) as Record<string, any>
          )) {
            if (!candidateSet.has(pid)) continue;
            map[pid] = {
              isCompatible: raw.is_compatible,
              reason: raw.reason,
              severity: raw.severity,
              sourceAgent: raw.source_agent,
              conflictingProductIds: raw.conflicting_product_ids ?? [],
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
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <button
          onClick={() => router.back()}
          className="p-3 transition-colors hover:bg-muted"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold uppercase tracking-[0.1em]">
          Choose {category.label}
        </h1>
      </div>

      {/* Personalization banner */}
      {hasQuizFilters && (
        <div className="border-b border-border bg-muted px-6 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50">
            Matched for you — filtered based on your beauty profile
          </p>
        </div>
      )}

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-1 items-center gap-2 border border-border px-4 py-2">
          <Search className="h-4 w-4 text-foreground/30" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
          />
        </div>
        {isAnalyzing && (
          <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.15em] text-foreground/30">
            ⚗ analyzing…
          </span>
        )}
        {quotaExceeded && !isAnalyzing && (
          <span className="shrink-0 border border-foreground bg-foreground px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white">
            ! API Quota Met
          </span>
        )}
        <div className="flex border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-2 ${viewMode === "tiles" ? "bg-foreground text-white" : "text-foreground/40 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-foreground text-white" : "text-foreground/40 hover:bg-muted"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body: sidebar + product list */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border p-5 md:block">
          {displayedFilters
            .filter((f) => f.type === "checkbox" && f.options && f.options.length > 0)
            .map((filter) => (
              <div key={filter.key} className="mb-6">
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">
                  {filter.label}
                </h4>
                <div className="flex flex-col gap-2">
                  {filter.options!.map((opt) => {
                    const active = activeFilters[filter.key]?.has(opt) ?? false;
                    return (
                      <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFilter(filter.key, opt)}
                          className="h-3.5 w-3.5 rounded accent-accent"
                        />
                        {opt}
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
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">
                      <tr>
                        <th className="px-5 py-3">Product</th>
                        <th className="hidden px-5 py-3 sm:table-cell">Rating</th>
                        <th className="px-5 py-3 text-right">Price</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((product) => {
                        const isCurrentlySelected = currentProductId === product.id;
                        const compat = compatibilityMap[product.id];
                        const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                        const isError = hasConflict && compat.severity === "error";
                        const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;
                        return (
                          <tr key={product.id} className="hover:bg-muted/50">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                                  <img
                                    src={product.image || "/placeholder-product.jpg"}
                                    alt={getDisplayName(product.name)}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder-product.jpg";
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{getDisplayName(product.name)}</p>
                                  <p className="text-xs text-foreground/40">{getDisplayBrand(product.brand)}</p>
                                  {/* ChemAI compatibility badges */}
                                  {isCompatible && (
                                    <span className="mt-1 inline-flex items-center gap-1 border border-foreground/15 px-1.5 py-0.5">
                                      <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-foreground/30">✓ compatible</span>
                                      <span className="text-[6px] font-medium uppercase tracking-widest text-foreground/20">⚗ chemist</span>
                                    </span>
                                  )}
                                  {quotaExceeded && (
                                    <span className="mt-1 inline-flex items-center gap-1 bg-foreground px-1.5 py-0.5">
                                      <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-white">! API Quota Met</span>
                                      <span className="text-[6px] font-medium uppercase tracking-widest text-white/40">⚗ chemist</span>
                                    </span>
                                  )}
                                  {hasConflict && (
                                    <span className="group relative mt-1 inline-block cursor-default">
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${isError ? "bg-foreground" : "border border-foreground/50"}`}>
                                        <span className={`text-[7px] font-bold uppercase tracking-[0.1em] ${isError ? "text-white" : "text-foreground"}`}>
                                          {isError ? "✕ conflict" : "! warning"}
                                        </span>
                                        <span className={`text-[6px] font-medium uppercase tracking-widest ${isError ? "text-white/40" : "text-foreground/30"}`}>
                                          {compat.sourceAgent === "artist" ? "✦ artist" : "⚗ chemist"}
                                        </span>
                                      </span>
                                      <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-52 border border-border bg-background p-2 shadow-lg group-hover:block">
                                        <span className="block text-[10px] font-medium leading-snug text-foreground">{compat.reason}</span>
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-5 py-4 sm:table-cell">
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Star className="h-3.5 w-3.5 fill-foreground/60 text-foreground/60" />
                                {product.stampScore}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-bold">
                              {formatPrice(lowestPrice(product))}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {isCurrentlySelected ? (
                                <span className="inline-flex items-center gap-1 border border-foreground px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-foreground">
                                  <Check className="h-3.5 w-3.5" /> Selected
                                </span>
                              ) : (
                                <button
                                  onClick={() => selectProduct(product)}
                                  className="inline-flex items-center gap-1 bg-foreground px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:shadow-md hover:shadow-black/10"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((product) => {
                      const isCurrentlySelected = currentProductId === product.id;
                      const compat = compatibilityMap[product.id];
                      const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                      const isError = hasConflict && compat.severity === "error";
                      const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;
                      return (
                        <div
                          key={product.id}
                          className={`relative flex aspect-[3/5] flex-col border transition-all duration-200 hover:shadow-md hover:shadow-black/5 ${
                            isCurrentlySelected
                              ? "border-foreground bg-muted"
                              : "border-border bg-white"
                          }`}
                        >
                          <div className="h-[74%] overflow-hidden bg-muted p-1.5">
                            <img
                              src={product.image || "/placeholder-product.jpg"}
                              alt={getDisplayName(product.name)}
                              className="h-full w-full object-contain"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-product.jpg";
                              }}
                            />
                          </div>
                          <div className="flex flex-1 flex-col gap-1 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-foreground/40">
                                  {getDisplayBrand(product.brand)}
                                </p>
                                <h3 className="text-[11px] font-medium leading-tight">
                                  {getDisplayName(product.name)}
                                </h3>
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-foreground/60">
                                <Star className="h-2.5 w-2.5 fill-foreground/60 text-foreground/60" />
                                {product.stampScore}
                              </span>
                            </div>
                            <p className="mt-auto text-sm font-bold text-foreground">
                              {formatPrice(lowestPrice(product))}
                            </p>
                            {isCurrentlySelected ? (
                              <span className="mt-1 inline-flex w-full items-center justify-center gap-1 border border-foreground px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-foreground">
                                <Check className="h-3 w-3" /> Selected
                              </span>
                            ) : (
                              <button
                                onClick={() => selectProduct(product)}
                                className="mt-1 inline-flex w-full items-center justify-center gap-1 bg-foreground px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-white transition-all hover:shadow-md hover:shadow-black/10"
                              >
                                <Plus className="h-3 w-3" /> Add
                              </button>
                            )}
                          </div>
                          {/* ChemAI compatibility overlays (top-of-tile banner) */}
                          {isCompatible && (
                            <div className="absolute inset-x-0 top-0 z-10 border-b border-foreground/10 px-1.5 py-1">
                              <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-foreground/30">✓ compatible</p>
                              <p className="text-[6px] font-medium uppercase tracking-widest text-foreground/15">⚗ chemist agent</p>
                            </div>
                          )}
                          {quotaExceeded && (
                            <div className="absolute inset-x-0 top-0 z-10 bg-foreground px-1.5 py-1">
                              <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-white">! API Quota Met</p>
                              <p className="text-[6px] font-medium uppercase tracking-widest text-white/40">⚗ chemist agent</p>
                            </div>
                          )}
                          {hasConflict && (
                            <div className={`group absolute inset-x-0 top-0 z-10 cursor-default px-1.5 py-1 ${isError ? "bg-foreground" : "bg-foreground/80"}`}>
                              <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-white">
                                {isError ? "✕ conflict" : "! warning"}
                              </p>
                              <p className="text-[6px] font-medium uppercase tracking-widest text-white/40">
                                {compat.sourceAgent === "artist" ? "✦ artist" : "⚗ chemist"}
                              </p>
                              <div className="pointer-events-none absolute inset-x-0 top-full z-50 mt-px hidden border border-border bg-background p-2 shadow-lg group-hover:block">
                                <p className="text-[10px] font-medium leading-snug text-foreground">{compat.reason}</p>
                              </div>
                            </div>
                          )}
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
