"use client";

import Link from "next/link";
import { Product } from "@/types";
import { Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { getProductColorInfo } from "@/lib/productColor";

interface AddToBagCardProps {
  product: Product;
  onAddToBag: (product: Product) => void;
}

export default function AddToBagCard({ product, onAddToBag }: AddToBagCardProps) {
  const [saved, setSaved] = useState(false);
  const colorInfo = useMemo(() => getProductColorInfo(product), [product]);

  const pricing = useMemo(() => {
    const sorted = [...product.prices].sort((a, b) => a.price - b.price);
    const lowest = sorted[0]?.price ?? 0;
    const highest = sorted[sorted.length - 1]?.price ?? lowest;
    const hasDiscount = highest > lowest;
    const discountPercent = hasDiscount
      ? Math.round(((highest - lowest) / highest) * 100)
      : 0;
    return { lowest, highest, hasDiscount, discountPercent };
  }, [product.prices]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/10">
      {pricing.hasDiscount && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
          -{pricing.discountPercent}%
        </span>
      )}

      <button
        className={`absolute right-3 top-3 z-10 rounded-full p-1.5 transition-colors ${
          saved ? "bg-accent text-white" : "bg-white/90 text-foreground/50 hover:text-accent"
        }`}
        onClick={() => setSaved((prev) => !prev)}
        aria-label="Save for later"
      >
        <Heart className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
      </button>

      <Link href={`/product/${product.id}`} className="block">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-pink-50 via-muted to-rose-50 p-2">
          <img
            src={product.image || "/placeholder-product.jpg"}
            alt={product.name}
            className="h-36 w-full object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-product.jpg";
            }}
          />
        </div>
        <span className="mt-2 block min-h-14">
          <span className="block text-xs font-bold text-foreground">{product.brand}</span>
          <span className="mt-0.5 line-clamp-2 block text-[11px] font-medium leading-tight text-foreground/70">
            {product.name}
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-foreground/60">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
              style={{ backgroundColor: colorInfo.hex }}
              aria-label={`${colorInfo.label} swatch`}
              title={colorInfo.label}
            />
            {colorInfo.label}
          </span>
        </span>
      </Link>

      <div className="mt-2 text-base font-bold text-accent">
        ${pricing.lowest.toFixed(2)}{" "}
        {pricing.hasDiscount && (
          <span className="text-xs font-medium text-foreground/40 line-through">
            ${pricing.highest.toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-2">
        <button
          onClick={() => onAddToBag(product)}
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-all hover:brightness-110"
        >
          Add To Bag
        </button>
      </div>
    </div>
  );
}
