"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { CategoryKey, Product, CategoryDefinition, CompatibilityMap } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots } from "@/lib/buildSlots";
import { getQuizAutoFilters } from "@/lib/personalization";
import { X, Search, Star, Plus, LayoutGrid, List, Loader2 } from "lucide-react";
import AddToBagCard from "@/components/AddToBagCard";
import { getProductColorInfo } from "@/lib/productColor";
import { getBestOfferForProduct } from "@/lib/pricing";

type ViewMode = "tiles" | "list";

const PER_PAGE = 20;
// Max candidates to include in the compatibility batch call
const COMPAT_CANDIDATE_LIMIT = 20;

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

  const filtered = useMemo(() => products, [products]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold">Choose {category.label}</h2>
        <button onClick={onClose} className="p-2 hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-1 items-center gap-2 border border-border px-4 py-2">
          <Search className="h-4 w-4 text-foreground/40" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/40"
          />
        </div>

        {/* Analyzing indicator */}
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

        <div className="flex overflow-hidden border border-border">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-2 ${viewMode === "tiles" ? "bg-foreground text-background" : "text-foreground/50 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-foreground text-background" : "text-foreground/50 hover:bg-muted"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body: sidebar + product list */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border p-4 md:block">
          {displayedFilters
            .filter((f) => f.type === "checkbox" && f.options && f.options.length > 0)
            .map((filter) => (
              <div key={filter.key} className="mb-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {filter.label}
                </h4>
                <div className="flex flex-col gap-1.5">
                  {filter.options!.map((opt) => {
                    const active = activeFilters[filter.key]?.has(opt) ?? false;
                    return (
                      <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFilter(filter.key, opt)}
                          className="h-3.5 w-3.5 rounded border-border accent-accent"
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
            <p className="py-16 text-center text-sm text-foreground/40">Loading products...</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-red-500">{error}</p>
          ) : (
            <>
              {filtered.length > 0 ? (
                viewMode === "list" ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-foreground/50">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Rating</th>
                        <th className="px-4 py-3 text-right">Price</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((product) => {
                        const colorInfo = getProductColorInfo(product);
                        const compat = compatibilityMap[product.id];
                        const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                        const isError = hasConflict && compat.severity === "error";
                        const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;

                        return (
                          <tr key={product.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                                  <img
                                    src={product.image || "/placeholder-product.jpg"}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder-product.jpg";
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-xs text-foreground/50">{product.brand}</p>
                                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-foreground/50">
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                                      style={{ backgroundColor: colorInfo.hex }}
                                      title={colorInfo.label}
                                    />
                                    {colorInfo.label}
                                  </p>
                                  {/* Compatibility badges in list view */}
                                  {isCompatible && (
                                    <span className="mt-1 inline-flex items-center gap-1 border border-foreground/15 px-1.5 py-0.5">
                                      <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-foreground/30">
                                        ✓ compatible
                                      </span>
                                      <span className="text-[6px] font-medium uppercase tracking-widest text-foreground/20">
                                        ⚗ chemist
                                      </span>
                                    </span>
                                  )}
                                  {quotaExceeded && (
                                    <span className="mt-1 inline-flex items-center gap-1 bg-foreground px-1.5 py-0.5">
                                      <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-white">
                                        ! API Quota Met
                                      </span>
                                      <span className="text-[6px] font-medium uppercase tracking-widest text-white/40">
                                        ⚗ chemist
                                      </span>
                                    </span>
                                  )}
                                  {hasConflict && (
                                    <span
                                      className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 ${
                                        isError ? "bg-foreground" : "border border-foreground/50"
                                      }`}
                                      title={compat.reason}
                                    >
                                      <span
                                        className={`text-[7px] font-bold uppercase tracking-[0.1em] ${
                                          isError ? "text-white" : "text-foreground"
                                        }`}
                                      >
                                        {isError ? "✕ conflict" : "! warning"}
                                      </span>
                                      <span
                                        className={`text-[6px] font-medium uppercase tracking-widest ${
                                          isError ? "text-white/40" : "text-foreground/30"
                                        }`}
                                      >
                                        ⚗ chemist
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                                {product.stampScore}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ${(getBestOfferForProduct(product)?.price ?? 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => onSelect(product)}
                                className="inline-flex items-center gap-1 bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-80"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // Tile view — wrap each AddToBagCard with a compatibility overlay
                  <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((product) => {
                      const compat = compatibilityMap[product.id];
                      const hasConflict = !quotaExceeded && compat && !compat.isCompatible;
                      const isError = hasConflict && compat.severity === "error";
                      const showQuota = quotaExceeded;
                      const isCompatible = !quotaExceeded && !isAnalyzing && analyzedCandidateIds.has(product.id) && !compat;

                      return (
                        <div key={product.id} className="relative">
                          <AddToBagCard
                            product={product}
                            onAddToBag={() => onSelect(product)}
                          />
                          {/* Quota error overlay */}
                          {showQuota && (
                            <div className="absolute inset-x-0 top-0 z-20 rounded-t-2xl bg-foreground px-2 py-1">
                              <p className="text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-white">
                                ! API Quota Met
                              </p>
                              <p className="text-[7px] font-medium uppercase tracking-widest text-white/40">
                                ⚗ chemist agent
                              </p>
                            </div>
                          )}
                          {/* Compatible overlay */}
                          {isCompatible && (
                            <div className="absolute inset-x-0 top-0 z-20 rounded-t-2xl border-b border-foreground/10 px-2 py-1">
                              <p className="text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-foreground/30">
                                ✓ compatible
                              </p>
                              <p className="text-[7px] font-medium uppercase tracking-widest text-foreground/15">
                                ⚗ chemist agent
                              </p>
                            </div>
                          )}
                          {/* Conflict / warning overlay */}
                          {hasConflict && (
                            <div
                              className={`absolute inset-x-0 top-0 z-20 rounded-t-2xl px-2 py-1 ${
                                isError ? "bg-foreground" : "bg-foreground/80"
                              }`}
                              title={compat.reason}
                            >
                              <p className="text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-white">
                                {isError ? "✕ conflict" : "! warning"}
                              </p>
                              <p className="text-[7px] font-medium uppercase tracking-widest text-white/40">
                                ⚗ chemist agent
                              </p>
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
