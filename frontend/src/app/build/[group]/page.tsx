"use client";

import { useState, useEffect } from "react";
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
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";

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

  const [slots, setSlots] = useState<ToolboxSlot[]>(initialSlots);

  useEffect(() => {
    setSlots(loadSlots());
  }, []);

  const handleRemove = (category: CategoryKey) => {
    setSlots((prev) => {
      const updated = prev.map((slot) =>
        slot.category === category ? { ...slot, product: null } : slot
      );
      saveSlots(updated);
      return updated;
    });
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {group.categories.map((catKey) => {
          const slot = slotMap[catKey];
          const filled = slot?.product !== null;
          const Icon = categoryIcons[catKey];

          return (
            <div
              key={catKey}
              className={`relative flex aspect-[3/5] flex-col items-center border px-3 pb-4 pt-6 text-center transition-all duration-200 ${
                filled
                  ? "border-foreground bg-muted"
                  : "border-border bg-white hover:border-foreground hover:shadow-md hover:shadow-black/5"
              }`}
            >
              {/* Icon / Product image */}
              {filled ? (
                <div className="mb-4 h-20 w-full overflow-hidden bg-muted">
                  <img
                    src={slot.product!.image || "/placeholder-product.jpg"}
                    alt={getDisplayName(slot.product!.name)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-product.jpg";
                    }}
                  />
                </div>
              ) : (
                <Icon className="mb-4 h-6 w-6 text-foreground/20" />
              )}

              {/* Category label */}
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">
                {categoryLabel(catKey)}
              </p>

              {filled ? (
                <>
                  <p className="text-xs text-foreground/40">{getDisplayBrand(slot.product!.brand)}</p>
                  <p className="text-sm font-medium leading-snug">{getDisplayName(slot.product!.name)}</p>
                  <p className="mt-auto pt-2 text-base font-bold text-foreground">
                    {formatPrice(lowestPrice(slot.product!))}
                  </p>

                  <button
                    onClick={() => handleRemove(catKey)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center bg-foreground text-white shadow-sm transition-colors hover:bg-foreground/80"
                    aria-label={`Remove ${getDisplayName(slot.product!.name)}`}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-1 items-center justify-center">
                    <span className="text-sm text-foreground/20">&mdash;</span>
                  </div>
                  <Link
                    href={`/build/category/${catKey}`}
                    className="mt-auto inline-flex w-full items-center justify-center gap-1 bg-foreground px-3 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:shadow-md hover:shadow-black/10"
                  >
                    <Plus className="h-3 w-3" /> Choose
                  </Link>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
