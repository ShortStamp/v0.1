"use client";

import { Product } from "@/types";
import { X, Search } from "lucide-react";
import ProductCard from "./ProductCard";
import { useState } from "react";

interface ProductFinderModalProps {
  category: string;
  products: Product[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export default function ProductFinderModal({
  category,
  products,
  onSelect,
  onClose,
}: ProductFinderModalProps) {
  const [search, setSearch] = useState("");

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-6 pb-4">
          <h2 className="text-lg font-bold">{category} — Product Finder</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Search className="h-4 w-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/40"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelect}
                  selectable
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-foreground/40">
              No products found for &quot;{search}&quot;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
