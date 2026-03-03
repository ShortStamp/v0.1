"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { categoryGroups } from "@/lib/data";
import { readBuildSlots } from "@/lib/buildSlots";
import { useCompatibility } from "@/lib/useCompatibility";
import { MakeupRecipeCard } from "@/components/MakeupRecipeCard";
import {
  Droplets,
  Eye,
  PenLine,
  Heart,
  Circle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const groupIcons: Record<string, LucideIcon> = {
  base: Droplets,
  eyes: Eye,
  brows: PenLine,
  cheeks: Heart,
  lips: Circle,
};

export default function BuildPage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [filledSlots, setFilledSlots] = useState<Record<string, string>>({});
  const [isLoadingQuizRedirect, setIsLoadingQuizRedirect] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    setFilledSlots(readBuildSlots());
    
    const saved = localStorage.getItem("beautyProfile");
    if (!saved) {
      setIsLoadingQuizRedirect(true);
      router.push("/build/quiz");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const { compatibilityMap, analyzedIds, isAnalyzing, quotaExceeded, recipeCard, overallScore } = useCompatibility(filledSlots);

  // Core Face progress: Focus on the "Base" group categories
  const baseGroup = categoryGroups.find(g => g.key === "base");
  const coreCategories = baseGroup ? baseGroup.categories : [];
  const coreFilled = coreCategories.filter(cat => filledSlots[cat]).length;
  const coreTotal = coreCategories.length;
  const coreProgress = Math.round(coreTotal > 0 ? (coreFilled / coreTotal) * 100 : 0);

  const totalCategories = categoryGroups.reduce((sum, g) => sum + g.categories.length, 0);
  const totalFilled = hasMounted ? Object.keys(filledSlots).length : 0;

  if (isLoadingQuizRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  const displayedGroups = categoryGroups;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
              Validation Engine
            </p>
          </div>
          <h1 className="mb-4 text-4xl font-bold font-serif">
            Set Compatibility Engine
          </h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-foreground/60 font-sans">
              Input your kit. Detect pilling. Perfect your finish. Our AI agents analyze mechanical and chemical stability in real-time.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("beautyProfile");
                router.push("/build/quiz");
              }}
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent transition-all hover:text-pink-deep font-sans"
            >
              Retake Quiz &rarr;
            </button>
          </div>
        </div>

        {/* Core Face progress */}
        <div className="mb-16 rounded-3xl bg-white p-8 shadow-xl shadow-accent/5 border border-border/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                Core Face Readiness
              </span>
              <p className="text-2xl font-bold font-sans">
                {coreProgress}% <span className="text-sm font-medium text-foreground/40 font-sans">{coreProgress === 100 ? "Ready for Analysis" : "Complete"}</span>
              </p>
            </div>
            <div className="text-right">
               <span className="text-sm font-bold font-sans text-accent">
                {coreFilled} <span className="text-foreground/20">/</span> {coreTotal} <span className="text-[10px] uppercase text-foreground/20 ml-1">Core items</span>
              </span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${coreProgress}%` }}
            />
          </div>
          {coreProgress < 100 && (
            <p className="mt-4 text-[10px] text-foreground/40 italic font-sans">
              Tip: Add a Primer, Foundation, and Setting Powder to see full stability insights.
            </p>
          )}
        </div>

        {/* Face area group tiles */}
        <div className="flex flex-wrap justify-center gap-6">
          {displayedGroups.map((group) => {
            const Icon = groupIcons[group.key] ?? Circle;
            const filled = group.categories.filter(
              (cat) => filledSlots[cat]
            ).length;
            const total = group.categories.length;
            const isComplete = filled === total && total > 0;

            // Tally conflicts in this group from the compatibility map
            const groupConflicts = group.categories
              .map((cat) => filledSlots[cat])
              .filter((pid) => pid && compatibilityMap[pid] && !compatibilityMap[pid].isCompatible);
            const errorCount = groupConflicts.filter(
              (pid) => compatibilityMap[pid]?.severity === "error"
            ).length;
            const conflictCount = groupConflicts.length;
            const worstSeverity = errorCount > 0 ? "error" : conflictCount > 0 ? "warning" : null;

            return (
              <Link
                key={group.key}
                href={`/build/${group.key}`}
                className={`group flex w-full flex-col rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] ${
                  isComplete
                    ? "border-accent bg-accent text-white shadow-xl shadow-accent/20"
                    : "border-border/50 bg-white hover:border-accent"
                }`}
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                    isComplete ? "bg-white/20 text-white" : "bg-muted text-accent group-hover:bg-accent group-hover:text-white"
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 ${
                      isComplete ? "text-white/50" : "text-foreground/20"
                    }`}
                  />
                </div>

                <h2
                  className={`mb-1 text-xl font-bold tracking-tight font-serif ${
                    isComplete ? "text-white" : "text-foreground"
                  }`}
                >
                  {group.label}
                </h2>

                <p
                  className={`mb-6 text-xs font-sans font-medium uppercase tracking-widest ${
                    isComplete ? "text-white/60" : "text-foreground/40"
                  }`}
                >
                  {group.categories.length} {group.categories.length === 1 ? "category" : "categories"}
                </p>

                {/* Compatibility Badges */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {quotaExceeded && filled > 0 && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : "bg-foreground text-white"
                    }`}>
                      ! API Quota
                    </div>
                  )}

                  {!quotaExceeded && worstSeverity && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : worstSeverity === "error" ? "bg-red-500 text-white" : "bg-amber-400 text-foreground"
                    }`}>
                      {worstSeverity === "error" ? "✕" : "!"} {conflictCount} Conflict{conflictCount > 1 ? "s" : ""}
                    </div>
                  )}

                  {!quotaExceeded && !isAnalyzing && !worstSeverity && filled > 0 &&
                    group.categories
                      .filter((cat) => filledSlots[cat])
                      .every((cat) => analyzedIds.has(filledSlots[cat])) && (
                    <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans ${
                      isComplete ? "bg-white/20 text-white" : "bg-green-50 text-green-600 border border-green-100"
                    }`}>
                      ✓ Compatible
                    </div>
                  )}

                  {isAnalyzing && filled > 0 && !worstSeverity && (
                     <div className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.15em] font-sans animate-pulse ${
                      isComplete ? "bg-white/10 text-white/50" : "bg-muted text-foreground/30"
                    }`}>
                      ⚗ Analyzing…
                    </div>
                  )}
                </div>

                {/* Fill count bar */}
                <div className="mt-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.2em] font-sans ${
                        isComplete ? "text-white/60" : "text-foreground/30"
                      }`}
                    >
                      {filled} <span className="opacity-50">/</span> {total} selected
                    </span>
                  </div>
                  <div
                    className={`h-1.5 w-full rounded-full ${
                      isComplete ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isComplete ? "bg-white" : "bg-accent"
                      }`}
                      style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>


        {/* Makeup Recipe Card — Sophisticated Final Summary */}
        {recipeCard && !isAnalyzing && (
          <MakeupRecipeCard 
            recipe={recipeCard} 
            overallScore={overallScore} 
          />
        )}
      </div>
    </div>
  );
}
