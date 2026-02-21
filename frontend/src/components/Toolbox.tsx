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
<<<<<<< Updated upstream
      className={`mt-8 rounded-2xl p-5 transition-colors ${
        isComplete
          ? "bg-gradient-to-r from-accent to-secondary text-white shadow-lg shadow-accent/20"
          : "border border-border bg-muted"
=======
      className={`mt-10 rounded-3xl p-8 transition-all duration-500 ${
        isComplete
          ? "bg-foreground text-background shadow-2xl shadow-black/20 scale-[1.02]"
          : "border border-border/50 bg-white shadow-xl shadow-accent/5"
>>>>>>> Stashed changes
      }`}
    >
      <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div
          className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] font-sans ${
            isComplete ? "text-accent-light" : "text-foreground/30"
          }`}
        >
          {isComplete ? (
            <div className="flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent-light">
              <Check className="h-4 w-4" />
              <span>Perfect Set Match!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
              <span className="text-accent">{filledSlots.length}/{slots.length}</span>
              <span>Slots Filled</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-8">
          <div className="text-center sm:text-right">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isComplete ? "text-white/40" : "text-foreground/30"}`}>Total Estimate</p>
            <p className="text-3xl font-bold font-sans tracking-tight">
              ${total.toFixed(2)}
            </p>
          </div>
          {filledSlots.length > 0 && (
            <button
              onClick={handleBuyAll}
              disabled={buyingAll}
              className={`group inline-flex items-center gap-2 rounded-full px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 font-sans ${
                isComplete
<<<<<<< Updated upstream
                  ? "bg-white text-accent hover:bg-white/90 disabled:opacity-50"
                  : "bg-accent text-white hover:brightness-110 disabled:opacity-50"
              }`}
=======
                  ? "bg-accent text-white hover:bg-pink-deep shadow-lg shadow-accent/20"
                  : "bg-foreground text-background hover:opacity-90 shadow-lg shadow-black/10"
              } disabled:opacity-50`}
>>>>>>> Stashed changes
            >
              <ShoppingCart className={`h-4 w-4 transition-transform group-hover:-translate-y-0.5 ${buyingAll ? "animate-bounce" : ""}`} />
              {buyingAll ? "Opening Tabs..." : `Checkout Look (${filledSlots.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Buy all breakdown */}
      {filledSlots.length > 0 && (
        <div className={`mt-8 border-t pt-8 ${isComplete ? "border-white/10" : "border-border/30"}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filledSlots.map((slot) => {
              const best = getLowestRetailer(slot);
              return (
                <div
                  key={slot.category}
                  className={`flex flex-col gap-1 rounded-2xl p-4 transition-colors ${
                    isComplete ? "bg-white/5 hover:bg-white/10" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
<<<<<<< Updated upstream
                  <span>{slot.product!.name}</span>
                  <span className="font-medium">
                    ${best?.price.toFixed(2)} @ {best?.retailer}
                  </span>
=======
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isComplete ? "text-white/40" : "text-foreground/30"}`}>{slot.category}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate max-w-[120px] font-serif ${isComplete ? "text-white" : "text-foreground"}`}>{slot.product!.name}</span>
                    <span className={`text-[10px] font-bold font-sans ${isComplete ? "text-accent-light" : "text-accent"}`}>
                      {best && hasKnownPrice(best)
                        ? `$${best.price.toFixed(2)}`
                        : "Check Price"}
                    </span>
                  </div>
>>>>>>> Stashed changes
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
