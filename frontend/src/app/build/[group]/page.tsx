"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CategoryKey, ToolboxSlot, Product } from "@/types";
import { categoryDefinitions, categoryGroups } from "@/lib/data";
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
  try {
    const raw = localStorage.getItem("buildSlots");
    if (!raw) return initialSlots;
    const saved: ToolboxSlot[] = JSON.parse(raw);
    return initialSlots.map((slot) => {
      const match = saved.find((s) => s.category === slot.category);
      return match ? match : slot;
    });
  } catch {
    return initialSlots;
  }
}

function saveSlots(slots: ToolboxSlot[]) {
  localStorage.setItem("buildSlots", JSON.stringify(slots));
}

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupKey = params.group as string;
  const group = categoryGroups.find((g) => g.key === groupKey);

  const [slots, setSlots] = useState<ToolboxSlot[]>(() => loadSlots());

  const handleRemove = (category: CategoryKey) => {
    setSlots((prev) => {
      const updated = prev.map((slot) =>
        slot.category === category ? { ...slot, product: null } : slot
      );
      saveSlots(updated);
      return updated;
    });
  };

  const lowestPrice = (p: Product) => Math.min(...p.prices.map((r) => r.price));

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
          className="rounded-xl p-2 transition-colors hover:bg-muted hover:text-accent"
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {group.categories.map((catKey) => {
          const slot = slotMap[catKey];
          const filled = slot?.product !== null;
          const Icon = categoryIcons[catKey];

          return (
            <div
              key={catKey}
<<<<<<< Updated upstream
              className={`relative flex aspect-[3/5] flex-col items-center rounded-2xl border px-3 pb-4 pt-6 text-center transition-all ${
                filled
                  ? "border-accent bg-accent/5"
                  : "border-border bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10"
=======
              className={`group relative flex aspect-[3/5] flex-col items-center justify-between overflow-hidden rounded-3xl border p-4 text-center transition-all duration-300 hover:-translate-y-1 ${
                filled
                  ? "border-accent/30 bg-white shadow-xl shadow-accent/10"
                  : "border-border/50 bg-white hover:border-accent hover:shadow-xl hover:shadow-accent/5"
>>>>>>> Stashed changes
              }`}
            >
              {/* Icon / Product image */}
              {filled ? (
<<<<<<< Updated upstream
                <div className="mb-4 h-20 w-full overflow-hidden rounded-xl bg-muted">
=======
                <div className="relative mb-4 h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-pink-soft/10 p-4">
>>>>>>> Stashed changes
                  <img
                    // eslint-disable-next-line @next/next/no-img-element
                    src={slot.product!.image || "/placeholder-product.jpg"}
<<<<<<< Updated upstream
                    alt={slot.product!.name}
                    className="h-full w-full object-cover"
=======
                    alt={getDisplayName(slot.product!.name)}
                    className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
>>>>>>> Stashed changes
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-product.jpg";
                    }}
                  />
                  <div className="absolute right-2 top-2">
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
<<<<<<< Updated upstream
                <Icon className="mb-4 h-6 w-6 text-pink-200" />
=======
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted text-foreground/20 transition-colors group-hover:bg-accent/5 group-hover:text-accent">
                    <Icon className="h-8 w-8" />
                </div>
>>>>>>> Stashed changes
              )}

              {/* Content */}
              <div className="flex w-full flex-1 flex-col items-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                    {categoryLabel(catKey)}
                </p>

<<<<<<< Updated upstream
              {filled ? (
                <>
                  <p className="text-xs text-foreground/40">{slot.product!.brand}</p>
                  <p className="text-sm font-medium leading-snug">{slot.product!.name}</p>
                  <p className="mt-auto pt-2 text-base font-bold text-accent">
                    ${lowestPrice(slot.product!).toFixed(2)}
                  </p>

                  <button
                    onClick={() => handleRemove(catKey)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-pink-400 shadow-sm transition-colors hover:bg-accent hover:text-white"
                    aria-label={`Remove ${slot.product!.name}`}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-1 items-center justify-center">
                    <span className="text-sm text-pink-200">&mdash;</span>
                  </div>
                  <Link
                    href={`/build/category/${catKey}`}
                    className="mt-auto inline-flex w-full items-center justify-center gap-1 rounded-full bg-accent px-3 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:shadow-md hover:shadow-accent/20 hover:brightness-110"
                  >
                    <Plus className="h-3 w-3" /> Choose
                  </Link>
                </>
              )}
=======
                {filled ? (
                    <div className="w-full flex-1 flex flex-col items-center">
                        <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-accent font-sans">{getDisplayBrand(slot.product!.brand)}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-tight font-serif">{getDisplayName(slot.product!.name)}</p>

                        {/* Chemist agent badges */}
                        {quotaExceeded ? (
                            <div className="mt-3 rounded-full bg-foreground px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white font-sans">
                                ! API Quota Met
                            </div>
                        ) : (() => {
                            const compat = compatibilityMap[slot.product!.id];
                            if (!compat) return null;
                            const isError = compat.severity === "error";
                            return (
                            <div
                                className={`group/tooltip relative mt-3 cursor-default rounded-full px-2 py-1 ${
                                isError ? "bg-red-500 text-white" : "bg-amber-100 text-amber-800"
                                }`}
                            >
                                <p className="text-[8px] font-bold uppercase tracking-[0.1em] font-sans flex items-center gap-1">
                                {isError ? "✕ Conflict" : "! Warning"}
                                </p>
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 z-50 mb-2 hidden w-48 rounded-xl border border-border bg-white p-3 shadow-xl group-hover/tooltip:block text-left">
                                <p className="text-[10px] font-medium leading-relaxed text-foreground font-sans">{compat.reason}</p>
                                </div>
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
>>>>>>> Stashed changes
            </div>
          );
        })}
      </div>
    </div>
  );
}
