"use client";

import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { CategoryKey } from "@/types";

interface SaveProductButtonProps {
  productId: string;
  category: CategoryKey;
}

export default function SaveProductButton({ productId, category }: SaveProductButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const slots = JSON.parse(sessionStorage.getItem("buildSlots") || "{}");
    setSaved(slots[category] === productId);
  }, [productId, category]);

  const handleSave = () => {
    const slots = JSON.parse(sessionStorage.getItem("buildSlots") || "{}");
    slots[category] = productId;
    sessionStorage.setItem("buildSlots", JSON.stringify(slots));
    setSaved(true);
  };

  const handleSaveAndBack = () => {
    handleSave();
    router.push("/build");
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleSave}
        className={`inline-flex flex-1 items-center justify-center gap-2 border px-6 py-3 text-sm font-medium transition-all ${
          saved
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-foreground hover:border-accent"
        }`}
      >
        {saved ? (
          <>
            <BookmarkCheck className="h-4 w-4" /> Saved to Build
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" /> Save to Build
          </>
        )}
      </button>
      <button
        onClick={handleSaveAndBack}
        className="inline-flex items-center justify-center gap-2 border border-foreground bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:opacity-80"
      >
        Save & Go Back
      </button>
    </div>
  );
}
