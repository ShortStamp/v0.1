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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-xl font-bold">Choose {category.label}</h2>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-4 py-2">
          <Search className="h-4 w-4 text-foreground/40" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/40"
          />
        </div>
        <div className="flex rounded-full border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-2 ${viewMode === "tiles" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
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
          )}
        </div>
      </div>
    </div>
  );
}
