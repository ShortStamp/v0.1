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
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-background p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10">
      {pricing.hasDiscount && (
        <span className="absolute left-4 top-4 z-10 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-accent/20 font-sans">
          {pricing.discountPercent}% OFF
        </span>
      )}

      <button
        className={`absolute right-4 top-4 z-10 rounded-full p-2 transition-all duration-300 ${
          saved ? "bg-accent text-white" : "bg-white/80 text-foreground/40 backdrop-blur-sm hover:text-accent hover:bg-white"
        } shadow-sm`}
        onClick={() => setSaved((prev) => !prev)}
        aria-label="Save for later"
      >
        <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
      </button>

      <Link href={`/product/${product.id}`} className="block flex-1">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-pink-soft/10 p-4 transition-colors group-hover:from-pink-soft/20">
          <img
            // eslint-disable-next-line @next/next/no-img-element
            src={product.image || "/placeholder-product.jpg"}
            alt={product.name}
            className="h-40 w-full object-contain transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-product.jpg";
            }}
          />
        </div>
        <div className="mt-4 px-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{product.brand}</span>
          <span className="mt-1 line-clamp-2 block min-h-[32px] text-sm font-semibold leading-tight text-foreground font-serif">
            {product.name}
          </span>
          <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted/50 px-2 py-1 text-[10px] font-medium text-foreground/60 font-sans">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
              style={{ backgroundColor: colorInfo.hex }}
              aria-label={`${colorInfo.label} swatch`}
              title={colorInfo.label}
            />
            {colorInfo.label}
          </span>
        </div>
      </Link>

      <div className="mt-4 px-1 flex items-baseline gap-2">
        <span className="text-lg font-bold text-foreground font-sans tracking-tight">
          ${pricing.lowest.toFixed(2)}
        </span>
        {pricing.hasDiscount && (
          <span className="text-[11px] font-medium text-foreground/30 line-through font-sans">
            ${pricing.highest.toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={() => onAddToBag(product)}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-foreground px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-background transition-all duration-300 hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-accent/20 font-sans"
        >
          Select Product
        </button>
      </div>
    </div>
  );
}
