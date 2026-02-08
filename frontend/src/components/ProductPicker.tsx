"use client";

import { useState, useMemo } from "react";
import { CategoryKey, Product, CategoryDefinition } from "@/types";
import { categoryMap, sampleProducts } from "@/lib/data";
import { X, Search, Star, Plus, LayoutGrid, List } from "lucide-react";

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

  const allProducts = useMemo(
    () => sampleProducts.filter((p) => p.category === categoryKey),
    [categoryKey]
  );

  const filtered = useMemo(() => {
    return allProducts.filter((p) => {
      // search
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q)) return false;
      }
      // filters
      for (const [key, values] of Object.entries(activeFilters)) {
        if (values.size === 0) continue;
        const pVal = String(p.filters[key] ?? "");
        if (!values.has(pVal)) return false;
      }
      return true;
    });
  }, [allProducts, search, activeFilters]);

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
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2">
          <Search className="h-4 w-4 text-foreground/40" />
          <input
            type="text"
            placeholder={`Search ${category.label.toLowerCase()} products...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/40"
          />
        </div>
        <div className="flex rounded-lg border border-border">
          <button
            onClick={() => setViewMode("tiles")}
            className={`rounded-l-lg p-2 ${viewMode === "tiles" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-r-lg p-2 ${viewMode === "list" ? "bg-accent text-white" : "text-foreground/50 hover:bg-muted"}`}
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
          {category.filters
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
                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-foreground/50">{product.brand}</p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {product.stampScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ${lowestPrice(product).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onSelect(product)}
                          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col rounded-xl border border-border bg-background transition-shadow hover:shadow-lg"
                  >
                    <div className="flex h-36 items-center justify-center bg-muted rounded-t-xl">
                      <span className="text-3xl text-foreground/10">
                        {category.label.charAt(0)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-foreground/50">{product.brand}</p>
                          <h3 className="text-sm font-semibold leading-tight">{product.name}</h3>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {product.stampScore}
                        </span>
                      </div>
                      <p className="mt-auto text-lg font-bold text-accent">
                        ${lowestPrice(product).toFixed(2)}
                      </p>
                      <button
                        onClick={() => onSelect(product)}
                        className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                  </div>
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
