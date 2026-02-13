"use client";

import { ToolboxSlot } from "@/types";
import { Check, ShoppingCart, ExternalLink } from "lucide-react";
import { useState } from "react";

interface ToolboxProps {
  slots: ToolboxSlot[];
}

export default function Toolbox({ slots }: ToolboxProps) {
  const [buyingAll, setBuyingAll] = useState(false);
  const filledSlots = slots.filter((s) => s.product !== null);

  const getLowestRetailer = (slot: ToolboxSlot) => {
    if (!slot.product) return null;
    const sorted = [...slot.product.prices].sort((a, b) => a.price - b.price);
    return sorted[0] || null;
  };

  const total = filledSlots.reduce((sum, s) => {
    const best = getLowestRetailer(s);
    return sum + (best?.price || 0);
  }, 0);
  const isComplete = filledSlots.length >= 3;

  const handleBuyAll = () => {
    setBuyingAll(true);
    // Open all buy links in new tabs
    filledSlots.forEach((slot, i) => {
      const best = getLowestRetailer(slot);
      if (best?.url) {
        setTimeout(() => {
          window.open(best.url, "_blank");
        }, i * 300); // stagger to avoid popup blockers
      }
    });
    setTimeout(() => setBuyingAll(false), 2000);
  };

  return (
    <div
      className={`mt-8 rounded-2xl p-5 transition-colors ${
        isComplete
          ? "bg-gradient-to-r from-accent to-secondary text-white shadow-lg shadow-accent/20"
          : "border border-border bg-muted"
      }`}
    >
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div
          className={`flex items-center gap-2 text-xs uppercase tracking-[0.1em] ${
            isComplete ? "text-white/80" : "text-foreground/40"
          }`}
        >
          {isComplete ? (
            <>
              <Check className="h-4 w-4" />
              <span>Set match: Looks great!</span>
            </>
          ) : (
            <span>
              {filledSlots.length}/{slots.length} categories filled — pick at least 3 to see set
              match.
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold">
            Total: ${total.toFixed(2)}
          </p>
          {filledSlots.length > 0 && (
            <button
              onClick={handleBuyAll}
              disabled={buyingAll}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                isComplete
                  ? "bg-white text-accent hover:bg-white/90 disabled:opacity-50"
                  : "bg-accent text-white hover:brightness-110 disabled:opacity-50"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              {buyingAll ? "Opening..." : `Buy Set (${filledSlots.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Buy all breakdown */}
      {filledSlots.length > 0 && (
        <div className={`mt-4 border-t pt-4 ${isComplete ? "border-white/20" : "border-border"}`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filledSlots.map((slot) => {
              const best = getLowestRetailer(slot);
              return (
                <div
                  key={slot.category}
                  className={`flex items-center justify-between text-xs ${
                    isComplete ? "text-white/70" : "text-foreground/50"
                  }`}
                >
                  <span>{slot.product!.name}</span>
                  <span className="font-medium">
                    ${best?.price.toFixed(2)} @ {best?.retailer}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
