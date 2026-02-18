"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryKey, Product, CategoryDefinition } from "@/types";
import { categoryMap } from "@/lib/data";
import { api } from "@/lib/api";
import { readBuildSlots, saveBuildSlot } from "@/lib/buildSlots";
import { getQuizAutoFilters } from "@/lib/personalization";
import { ArrowLeft, Search, Star, Plus, LayoutGrid, List, Check, Loader2 } from "lucide-react";

type ViewMode = "tiles" | "list";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryKey = params.slug as CategoryKey;
  const category: CategoryDefinition | undefined = categoryMap[categoryKey];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptionsByKey, setFilterOptionsByKey] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("tiles");

  useEffect(() => {
    if (!category) return;
    const defaults = getQuizAutoFilters(category);
    if (Object.keys(defaults).length === 0) return;
    setActiveFilters((prev) => (Object.keys(prev).length > 0 ? prev : defaults));
  }, [category]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!categoryKey) return;
      setLoading(true);
      try {
        const filters: Record<string, string> = {};
        for (const [key, values] of Object.entries(activeFilters)) {
          if (values.size > 0) {
            filters[key] = Array.from(values).join(",");
          }
        }
        let data = await api.getProducts({
          category: categoryKey,
          search: search || undefined,
          filters,
          per_page: 100,
        });
        // If filters returned nothing, retry without non-brand filters
        // (products may lack filter metadata from data source)
        if (data.items.length === 0 && Object.keys(filters).some((k) => k !== "brand")) {
          const brandOnly: Record<string, string> = {};
          if (filters.brand) brandOnly.brand = filters.brand;
          data = await api.getProducts({
            category: categoryKey,
            search: search || undefined,
            filters: brandOnly,
            per_page: 100,
          });
        }
        setProducts(data.items);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [categoryKey, search, activeFilters]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!categoryKey) return;
      try {
        const data = await api.getProductFilterProperties({
          category: categoryKey,
        });
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
    if (!category) return [];
    return category.filters.map((filter) => {
      const options = filterOptionsByKey[filter.key];
      if (!options || options.length === 0) return filter;
      return {
        ...filter,
        options,
      };
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

  const lowestPrice = (p: Product) =>
    p.prices.length > 0 ? Math.min(...p.prices.map((r) => r.price)) : 0;

  const currentProductId: string | null = (() => {
    const slots = readBuildSlots();
    return slots[categoryKey] || null;
  })();

  const selectProduct = (product: Product) => {
    saveBuildSlot(categoryKey, product.id);
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
          className="rounded-xl p-3 transition-colors hover:bg-muted hover:text-accent"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold uppercase tracking-[0.1em]">
          Choose {category.label}
        </h1>
      </div>

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-4 py-2">
          <Search className="h-4 w-4 text-foreground/30" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30"
          />
        </div>
        <div className="flex rounded-full border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-2 ${viewMode === "tiles" ? "bg-accent text-white" : "text-foreground/40 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-accent text-white" : "text-foreground/40 hover:bg-muted"}`}
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
          ) : filtered.length > 0 ? (
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
                    return (
                      <tr key={product.id} className="hover:bg-muted/50">
                        <td className="px-5 py-4">
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
                              <p className="text-xs text-foreground/40">{product.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-5 py-4 sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Star className="h-3.5 w-3.5 fill-pink-400 text-pink-400" />
                            {product.stampScore}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          ${lowestPrice(product).toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isCurrentlySelected ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
                              <Check className="h-3.5 w-3.5" /> Selected
                            </span>
                          ) : (
                            <button
                              onClick={() => selectProduct(product)}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:shadow-md hover:shadow-accent/20 hover:brightness-110"
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
                  return (
                    <div
                      key={product.id}
                      className={`flex aspect-[3/5] flex-col rounded-xl border transition-all hover:shadow-md hover:shadow-accent/10 ${
                        isCurrentlySelected
                          ? "border-accent bg-accent/5"
                          : "border-border bg-white"
                      }`}
                    >
                      <div className="h-[74%] overflow-hidden rounded-t-xl bg-gradient-to-br from-pink-50 via-muted to-rose-50 p-1.5">
                        <img
                          src={product.image || "/placeholder-product.jpg"}
                          alt={product.name}
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
                              {product.brand}
                            </p>
                            <h3 className="text-[11px] font-medium leading-tight">{product.name}</h3>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-pink-500">
                            <Star className="h-2.5 w-2.5 fill-pink-400 text-pink-400" />
                            {product.stampScore}
                          </span>
                        </div>
                        <p className="mt-auto text-sm font-bold text-accent">
                          ${lowestPrice(product).toFixed(2)}
                        </p>
                        {isCurrentlySelected ? (
                          <span className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-full border border-accent px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-accent">
                            <Check className="h-3 w-3" /> Selected
                          </span>
                        ) : (
                          <button
                            onClick={() => selectProduct(product)}
                            className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-full bg-accent px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-white transition-all hover:shadow-md hover:shadow-accent/20 hover:brightness-110"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        )}
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
        </div>
      </div>
    </div>
  );
}
