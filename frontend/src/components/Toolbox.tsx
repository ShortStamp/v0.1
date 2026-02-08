"use client";

import { ToolboxSlot, FaceRegion } from "@/types";
import { Check, X, ShoppingBag } from "lucide-react";

interface ToolboxProps {
  slots: ToolboxSlot[];
  onRemove: (region: FaceRegion) => void;
}

export default function Toolbox({ slots, onRemove }: ToolboxProps) {
  const filledSlots = slots.filter((s) => s.product !== null);
  const isComplete = filledSlots.length >= 3;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Your Toolbox</h3>
        <span className="text-sm text-foreground/50">
          {filledSlots.length}/{slots.length} slots filled
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {slots.map((slot) => (
          <div
            key={slot.region}
            className={`relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center ${
              slot.product ? "border-accent/30 bg-accent/5" : "border-border bg-muted"
            }`}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/40">
              {slot.region}
            </p>
            {slot.product ? (
              <>
                <ShoppingBag className="h-5 w-5 text-accent" />
                <p className="line-clamp-1 text-xs font-medium">{slot.product.name}</p>
                <button
                  onClick={() => onRemove(slot.region)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-100 p-0.5 text-red-500 hover:bg-red-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="flex h-10 items-center">
                <span className="text-xs text-foreground/30">Empty</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Match indicator */}
      <div
        className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          isComplete
            ? "bg-green-50 text-green-700"
            : "bg-foreground/5 text-foreground/50"
        }`}
      >
        {isComplete ? (
          <>
            <Check className="h-4 w-4" />
            Your set looks great together!
          </>
        ) : (
          <>Fill at least 3 slots to see if your items match as a set.</>
        )}
      </div>
    </div>
  );
}
