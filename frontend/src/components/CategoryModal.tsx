"use client";

import { FaceCategory, FaceRegion } from "@/types";
import { X } from "lucide-react";

interface CategoryModalProps {
  region: FaceRegion;
  categories: FaceCategory;
  onSelectCategory: (category: string) => void;
  onClose: () => void;
}

export default function CategoryModal({
  region,
  categories,
  onSelectCategory,
  onClose,
}: CategoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold capitalize">{region} — Categories</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {categories.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className="rounded-lg border border-border px-4 py-3 text-left font-medium transition-colors hover:border-accent hover:bg-accent/5"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
