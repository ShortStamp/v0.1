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
      className={`mt-8 border p-5 transition-colors ${
        isComplete
          ? "border-black bg-black text-white"
          : "border-border bg-neutral-50"
      }`}
    >
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div
          className={`flex items-center gap-2 text-xs uppercase tracking-[0.1em] ${
            isComplete ? "text-white" : "text-neutral-400"
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
