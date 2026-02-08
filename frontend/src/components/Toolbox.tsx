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
    <div className="mt-6 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div
          className={`flex items-center gap-2 text-sm ${
            isComplete ? "text-green-700" : "text-foreground/50"
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
          Total: <span className="text-accent">${total.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
