"use client";

import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { CategoryKey } from "@/types";
import { readBuildSlots, saveBuildSlot } from "@/lib/buildSlots";

interface SaveProductButtonProps {
  productId: string;
  category: CategoryKey;
}

export default function SaveProductButton({ productId, category }: SaveProductButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const slots = readBuildSlots();
    setSaved(slots[category] === productId);
  }, [productId, category]);

  const handleSave = () => {
    saveBuildSlot(category, productId);
    setSaved(true);
  };

  const handleSaveAndBack = () => {
    handleSave();
    router.push("/build");
  };

  return (
    <div className="flex gap-4">
      <button
        onClick={handleSave}
        className={`group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-300 font-sans ${
          saved
            ? "border-accent bg-accent/10 text-accent"
            : "border-border/50 bg-white text-foreground/60 hover:border-accent hover:text-accent"
        }`}
      >
        {saved ? (
          <>
            <BookmarkCheck className="h-4 w-4" /> Saved
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" /> Save to Build
          </>
        )}
      </button>
      <button
        onClick={handleSaveAndBack}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-background transition-all duration-300 hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-accent/20 font-sans"
      >
        Save & Return
      </button>
    </div>
  );
}
