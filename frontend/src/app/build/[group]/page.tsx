"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CategoryKey, ToolboxSlot, Product } from "@/types";
import { categoryDefinitions, categoryGroups } from "@/lib/data";
import { readBuildSlots, removeBuildSlot, readBuildProductCache } from "@/lib/buildSlots";
import { ConflictBadge } from "@/components/DebugTrace";
import {
  ArrowLeft,
  Plus,
  X as XIcon,
  Droplets,
  EyeOff,
  Pipette,
  Wind,
  SprayCan,
  Eye,
  Pen,
  Sparkles,
  Flower2,
  Pencil,
  Brush,
  Heart,
  Sun,
  Diamond,
  Pentagon,
  Circle,
  Candy,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";
import { useCompatibility } from "@/lib/useCompatibility";

const categoryIcons: Record<CategoryKey, LucideIcon> = {
  foundation: Droplets,
  concealer: EyeOff,
  primer: Pipette,
  powder: Wind,
  "setting-spray": SprayCan,
  eyeshadow: Eye,
  eyeliner: Pen,
  mascara: Sparkles,
  "false-lashes": Flower2,
  "brow-pencil": Pencil,
  "brow-gel": Brush,
  blush: Heart,
  bronzer: Sun,
  highlighter: Diamond,
  contour: Pentagon,
  lipstick: Circle,
  "lip-gloss": Candy,
  "lip-liner": PenLine,
};

const initialSlots: ToolboxSlot[] = categoryDefinitions.map((c) => ({
  category: c.key,
  product: null,
}));

function loadSlots(): ToolboxSlot[] {
  if (typeof window === "undefined") return initialSlots;
  const flatSlots = readBuildSlots();         // Record<categoryKey, productId>
  const productCache = readBuildProductCache(); // Record<productId, Product>
  return initialSlots.map((slot) => {
    const productId = flatSlots[slot.category];
    if (!productId) return { ...slot, product: null };
    const product = productCache[productId] ?? null;
    return { ...slot, product };
  });
}

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupKey = params.group as string;
  const group = categoryGroups.find((g) => g.key === groupKey);

  const [slots, setSlots] = useState<ToolboxSlot[]>(initialSlots);

  useEffect(() => {
    setSlots(loadSlots());
  }, []);

  // Build filledSlots map (category → productId) for the compatibility hook
  const filledSlotsForCompat = Object.fromEntries(
    slots.filter((s) => s.product).map((s) => [s.category, s.product!.id])
  );
  const { compatibilityMap, analyzedIds, isAnalyzing, quotaExceeded } = useCompatibility(filledSlotsForCompat);

  const handleRemove = (category: CategoryKey) => {
    removeBuildSlot(category);
    setSlots((prev) =>
      prev.map((slot) =>
        slot.category === category ? { ...slot, product: null } : slot
      )
    );
  };

  const lowestPrice = (p: Product) => getBestOfferForProduct(p)?.price ?? 0;

  const categoryLabel = (key: CategoryKey) =>
    categoryDefinitions.find((c) => c.key === key)?.label ?? key;

  const slotMap = Object.fromEntries(slots.map((s) => [s.category, s])) as Record<
    CategoryKey,
    ToolboxSlot
  >;

  if (!group) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-foreground/40">Group not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-10 flex items-center gap-4">
        <button
          onClick={() => router.push("/build")}
          className="p-2 transition-colors hover:bg-muted"
          aria-label="Back to build"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">{group.label}</h1>
          <p className="text-sm text-foreground/40">
            Choose products for each category below.
          </p>
        </div>
      </div>

      {/* Category tiles */}
      <div className="flex flex-wrap justify-center gap-4">
        {group.categories.map((catKey) => {
          const slot = slotMap[catKey];
          const filled = slot?.product !== null;
          const Icon = categoryIcons[catKey];

          return (
            <div
              key={catKey}
              className={`group relative flex aspect-[3/5] flex-col items-center justify-between overflow-hidden rounded-3xl border p-4 text-center transition-all duration-300 hover:-translate-y-1 w-[calc(50%-8px)] ${
                group.categories.length <= 2
                  ? "sm:w-[calc(50%-8px)]"
                  : "sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)]"
              } ${
                filled
                  ? "border-accent/30 bg-white shadow-xl shadow-accent/10"
                  : "border-border/50 bg-white hover:border-accent hover:shadow-xl hover:shadow-accent/5"
              }`}
            >
              {/* Icon / Product image */}
              {filled ? (
                <div className="relative mb-4 h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-pink-soft/10 p-4">
                  <Link href={`/product/${slot.product!.id}`} className="block h-full w-full">
                    <img
                      // eslint-disable-next-line @next/next/no-img-element
                      src={slot.product!.image || "/placeholder-product.jpg"}
                      alt={getDisplayName(slot.product!.name)}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-product.jpg";
                      }}
                    />
                  </Link>
                  <div className="absolute right-2 top-2 z-10">
                    <button
                        onClick={() => handleRemove(catKey)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-foreground/40 backdrop-blur-sm transition-colors hover:bg-red-50 hover:text-red-500 shadow-sm"
                        aria-label={`Remove ${getDisplayName(slot.product!.name)}`}
                    >
                        <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted text-foreground/20 transition-colors group-hover:bg-accent/5 group-hover:text-accent">
                    <Icon className="h-8 w-8" />
                </div>
              )}

              {/* Content */}
              <div className="flex w-full flex-1 flex-col items-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                    {categoryLabel(catKey)}
                </p>

                {filled ? (
                    <div className="w-full flex-1 flex flex-col items-center">
                        <Link href={`/product/${slot.product!.id}`} className="text-center hover:opacity-70 transition-opacity">
                          <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{getDisplayBrand(slot.product!.brand)}</p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-tight font-serif">{getDisplayName(slot.product!.name)}</p>
                        </Link>

                        {/* Chemist agent badges */}
                        {quotaExceeded ? (
                            <div className="mt-3 rounded-full bg-foreground px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white font-sans">
                                ! API Quota Met
                            </div>
                        ) : (() => {
                            const compat = compatibilityMap[slot.product!.id];
                            if (!compat) return null;
                            return (
                            <div className="mt-3">
                                <ConflictBadge
                                    compat={compat}
                                    resolveName={(id) => getDisplayName(slots.find((s) => s.product?.id === id)?.product?.name ?? "another product")}
                                    position="above"
                                />
                            </div>
                            );
                        })()}

                        {/* Analyzing shimmer */}
                        {!quotaExceeded && isAnalyzing && !compatibilityMap[slot.product!.id] && (
                            <p className="mt-3 animate-pulse text-[8px] font-bold uppercase tracking-widest text-accent/50 font-sans">
                            ⚗ Analyzing…
                            </p>
                        )}

                        {/* Compatible badge */}
                        {!quotaExceeded && !isAnalyzing && analyzedIds.has(slot.product!.id) && !compatibilityMap[slot.product!.id] && (
                            <div className="mt-3 rounded-full bg-green-50 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-green-600 border border-green-100 font-sans">
                            ✓ Compatible
                            </div>
                        )}

                        <div className="mt-auto pt-4 w-full border-t border-border/30">
                            <p className="text-lg font-bold text-foreground font-sans tracking-tight">
                                {formatPrice(lowestPrice(slot.product!))}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-end w-full">
                        <Link
                            href={`/build/category/${catKey}`}
                            className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-accent hover:shadow-lg hover:shadow-accent/20 font-sans"
                        >
                            <Plus className="h-3 w-3 transition-transform group-hover/btn:rotate-90" /> Select
                        </Link>
                    </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
