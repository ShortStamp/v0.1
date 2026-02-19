"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function StartBuildingButton() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleClick = () => {
    if (isAuthenticated) {
      router.push("/build");
    } else {
      router.push("/build/quiz");
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 bg-foreground px-10 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-background shadow-lg shadow-black/10 transition-all hover:shadow-xl hover:shadow-black/15 hover:opacity-90"
    >
      Start Building <ArrowRight className="h-4 w-4" />
    </button>
  );
}
