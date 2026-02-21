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
<<<<<<< Updated upstream
      className="inline-flex items-center gap-2 rounded-full bg-accent px-10 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30 hover:brightness-110"
=======
      className="group inline-flex items-center gap-3 rounded-full bg-accent px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-accent/20 transition-all duration-300 hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-0.5 font-sans"
>>>>>>> Stashed changes
    >
      Start Building 
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}
