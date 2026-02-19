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
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";

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
  const [profile, setProfile] = useState<BeautyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<ToolboxSlot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("beautyProfile");
    if (!saved) {
      router.push("/build/quiz");
      return;
    }
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
    return getBestOfferForProduct(product);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
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
                    <div className="mb-1 text-sm font-semibold">{getDisplayName(slot.product.name)}</div>
                    <div className="mb-3 text-xs text-foreground/50">{getDisplayBrand(slot.product.brand)}</div>
                    {best && (
                      <div className="mb-3 text-sm font-bold text-accent">
                        {formatPrice(best.price)}
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
