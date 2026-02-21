"use client";

import { useState, useMemo, useEffect } from "react";
import { CategoryKey, Product, CategoryDefinition } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { getQuizAutoFilters } from "@/lib/personalization";
import { X, Search, Star, Plus, LayoutGrid, List } from "lucide-react";
import AddToBagCard from "@/components/AddToBagCard";
import { getProductColorInfo } from "@/lib/productColor";

type ViewMode = "tiles" | "list";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaults = getQuizAutoFilters(category);
    if (Object.keys(defaults).length === 0) return;
    setActiveFilters((prev) => (Object.keys(prev).length > 0 ? prev : defaults));
  }, [category]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
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
          per_page: 100,
        });
        setProducts(data.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load products";
        setError(message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryKey, search, activeFilters]);

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

  const filtered = useMemo(() => {
    return products;
  }, [products]);

  const displayedFilters = useMemo(() => {
    return category.filters.map((filter) => {
      const options = filterOptionsByKey[filter.key];
      if (!options || options.length === 0) return filter;
      return {
        ...filter,
        options,
      };
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

  const lowestPrice = (p: Product) => Math.min(...p.prices.map((r) => r.price));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-2xl animate-pop-in">
      {/* Header */}
<<<<<<< Updated upstream
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold">Choose {category.label}</h2>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
=======
      <div className="flex items-center justify-between border-b border-border/50 bg-white/70 px-8 py-6 backdrop-blur-xl">
        <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Inventory Browser</p>
            <h2 className="text-2xl font-bold font-serif leading-none">Choose {category.label}</h2>
        </div>
        <button 
            onClick={onClose} 
            className="group flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-all hover:bg-accent hover:text-white" 
            aria-label="Close"
        >
          <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
>>>>>>> Stashed changes
        </button>
      </div>

      {/* Search bar + view toggle */}
<<<<<<< Updated upstream
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-4 py-2">
          <Search className="h-4 w-4 text-foreground/40" />
=======
      <div className="flex items-center gap-4 border-b border-border/50 bg-white/50 px-8 py-4 backdrop-blur-sm">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/50 bg-white px-5 py-3 shadow-sm transition-all focus-within:border-accent focus-within:shadow-lg focus-within:shadow-accent/5">
          <Search className="h-4 w-4 text-foreground/20" />
>>>>>>> Stashed changes
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-foreground/30 font-sans"
          />
        </div>
<<<<<<< Updated upstream
        <div className="flex rounded-full border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-2 ${viewMode === "tiles" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
=======

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
>>>>>>> Stashed changes
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
<<<<<<< Updated upstream
            className={`p-2 ${viewMode === "list" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
=======
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${viewMode === "list" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-foreground/30 hover:bg-muted"}`}
>>>>>>> Stashed changes
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
            <p className="py-16 text-center text-sm text-foreground/40">Loading products...</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-red-500">{error}</p>
<<<<<<< Updated upstream
          ) : filtered.length > 0 ? (
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
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Star className="h-3.5 w-3.5 fill-pink-400 text-pink-400" />
                            {product.stampScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          ${lowestPrice(product).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onSelect(product)}
                            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:brightness-110"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add To Bag
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {filtered.map((product) => (
                  <AddToBagCard
                    key={product.id}
                    product={product}
                    onAddToBag={() => onSelect(product)}
                  />
                ))}
              </div>
            )
          ) : (
            <p className="py-16 text-center text-sm text-foreground/40">
              {search
                ? `No products found for "${search}"`
                : "No products match the selected filters."}
            </p>
=======
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
                            <tr key={product.id} className="group transition-colors hover:bg-muted/30">
                                <td className="py-6 pl-4">
                                <div className="flex items-center gap-6">
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted p-2 transition-transform duration-500 group-hover:scale-110">
                                    <img
                                        // eslint-disable-next-line @next/next/no-img-element
                                        src={product.image || "/placeholder-product.jpg"}
                                        alt={product.name}
                                        className="h-full w-full object-contain"
                                        loading="lazy"
                                        onError={(e) => {
                                        e.currentTarget.src = "/placeholder-product.jpg";
                                        }}
                                    />
                                    </div>
                                    <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{product.brand}</p>
                                    <p className="font-semibold text-foreground font-serif text-base">{product.name}</p>
                                    
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
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-green-600 border border-green-100 font-sans">✓ Compatible</span>
                                        )}
                                        {quotaExceeded && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white font-sans">! API Quota</span>
                                        )}
                                        {hasConflict && (
                                            <div className="group/tooltip relative inline-block cursor-default">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest font-sans ${isError ? "bg-red-500 text-white" : "bg-amber-100 text-amber-800"}`}>
                                                    {isError ? "✕ Conflict" : "! Warning"}
                                                </span>
                                                <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-52 rounded-xl border border-border bg-white p-3 shadow-xl group-hover/tooltip:block">
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
                                    <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                                    <span className="font-bold text-foreground font-sans">{product.stampScore}</span>
                                </div>
                                </td>
                                <td className="py-6 text-right font-bold text-foreground font-sans text-lg tracking-tight">
                                ${(getBestOfferForProduct(product)?.price ?? 0).toFixed(2)}
                                </td>
                                <td className="py-6 text-right pr-4">
                                <button
                                    onClick={() => onSelect(product)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-accent hover:shadow-lg hover:shadow-accent/20 font-sans"
                                >
                                    <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" /> Add
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
                          className="group relative flex aspect-[3/5] flex-col overflow-hidden rounded-3xl border border-border/50 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/5"
                        >
                          <div className="relative h-[70%] overflow-hidden bg-muted/30 p-4 transition-colors group-hover:bg-muted/50">
                            <img
                              // eslint-disable-next-line @next/next/no-img-element
                              src={product.image || "/placeholder-product.jpg"}
                              alt={product.name}
                              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
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
                                        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-48 rounded-2xl border border-border/50 bg-white p-4 shadow-2xl opacity-0 translate-y-1 scale-95 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tooltip:opacity-100 group-hover/tooltip:translate-y-0 group-hover/tooltip:scale-100">
                                            <p className="text-[10px] font-medium leading-tight text-foreground font-sans">{compat.reason}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[9px] font-bold text-foreground backdrop-blur-sm shadow-sm font-sans">
                                <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5 fill-accent text-accent" /> {product.stampScore}</span>
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col gap-1 p-4">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-accent font-sans">
                                  {product.brand}
                                </p>
                                <h3 className="line-clamp-2 text-xs font-semibold leading-tight font-serif text-foreground">
                                  {product.name}
                                </h3>
                            </div>
                            
                            <div className="mt-auto pt-2 flex flex-col gap-2">
                                <p className="text-sm font-bold text-foreground font-sans tracking-tight">
                                    ${(getBestOfferForProduct(product)?.price ?? 0).toFixed(2)}
                                </p>
                                
                                <button
                                    onClick={() => onSelect(product)}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[9px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-accent hover:shadow-lg hover:shadow-accent/20 font-sans"
                                >
                                    <Plus className="h-3 w-3 transition-transform group-hover:rotate-90" /> Add
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
>>>>>>> Stashed changes
          )}
        </div>
      </div>
    </div>
  );
}
