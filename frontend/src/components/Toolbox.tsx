"use client";

import { ToolboxSlot } from "@/types";
import { Check } from "lucide-react";

interface ToolboxProps {
  slots: ToolboxSlot[];
}

export default function Toolbox({ slots }: ToolboxProps) {
  const filledSlots = slots.filter((s) => s.product !== null);
  const total = filledSlots.reduce((sum, s) => {
    const lowest = Math.min(...s.product!.prices.map((p) => p.price));
    return sum + lowest;
  }, 0);
  const isComplete = filledSlots.length >= 3;

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
        <p className="text-lg font-bold">
          Total: ${total.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
