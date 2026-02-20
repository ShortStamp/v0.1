"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CategoryKey } from "@/types";
import { categoryGroups } from "@/lib/data";
import { readBuildSlots } from "@/lib/buildSlots";
import { useCompatibility } from "@/lib/useCompatibility";
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
  const [filledSlots, setFilledSlots] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("beautyProfile");
    if (!saved) {
      router.push("/build/quiz");
      return;
    }
    setFilledSlots(readBuildSlots());
    setLoading(false);
  }, [router]);

  const { compatibilityMap, analyzedIds, isAnalyzing, quotaExceeded } = useCompatibility(filledSlots);

  const totalCategories = categoryGroups.reduce((sum, g) => sum + g.categories.length, 0);
  const totalFilled = Object.keys(filledSlots).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-4">
          <h1 className="mb-2 text-3xl font-bold uppercase tracking-tight">
            Build Your Look
          </h1>
          <p className="text-sm text-foreground/40">
            Select products across 5 face areas to create your perfect makeup toolbox.
          </p>
        </div>

        {/* Overall progress */}
        <div className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/40">
              Overall Progress
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/40">
              {totalFilled} / {totalCategories}
            </span>
          </div>
          <div className="h-1 w-full bg-muted">
            <div
              className="h-1 bg-foreground transition-all duration-300"
              style={{ width: `${totalCategories > 0 ? (totalFilled / totalCategories) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Edit profile link */}
        <div className="mb-8">
          <Link
            href="/build/quiz"
            className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-foreground"
          >
            Edit Profile &rarr;
          </Link>
        </div>

        {/* Face area group tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryGroups.map((group) => {
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
                className={`group flex flex-col border p-6 transition-all duration-200 hover:shadow-md hover:shadow-black/5 ${
                  isComplete
                    ? "border-foreground bg-foreground text-white"
                    : "border-border bg-white hover:border-foreground"
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon
                    className={`h-6 w-6 ${
                      isComplete ? "text-white/70" : "text-foreground/20"
                    }`}
                  />
                  <ChevronRight
                    className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 ${
                      isComplete ? "text-white/50" : "text-foreground/20"
                    }`}
                  />
                </div>

                <h2
                  className={`mb-1 text-lg font-bold uppercase tracking-[0.1em] ${
                    isComplete ? "text-white" : "text-foreground"
                  }`}
                >
                  {group.label}
                </h2>

                <p
                  className={`mb-4 text-xs ${
                    isComplete ? "text-white/50" : "text-foreground/40"
                  }`}
                >
                  {group.categories.length} {group.categories.length === 1 ? "category" : "categories"}
                </p>

                {/* Quota error badge (shown when Gemini API returns 429) */}
                {quotaExceeded && filled > 0 && (
                  <div className="mb-3">
                    <div
                      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 ${
                        isComplete ? "border-white/30 bg-white/10" : "border-foreground bg-foreground"
                      }`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${
                          isComplete ? "text-white" : "text-white"
                        }`}
                      >
                        ! API Quota Met
                      </span>
                      <span
                        className={`text-[8px] font-medium uppercase tracking-widest ${
                          isComplete ? "text-white/40" : "text-white/40"
                        }`}
                      >
                        ⚗ chemist
                      </span>
                    </div>
                  </div>
                )}

                {/* Conflict indicator (shown when chemist agent finds issues) */}
                {!quotaExceeded && worstSeverity && (
                  <div className="mb-3">
                    <div
                      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 ${
                        isComplete
                          ? "border-white/30 bg-white/10"
                          : worstSeverity === "error"
                          ? "border-foreground bg-foreground"
                          : "border-foreground/40"
                      }`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${
                          isComplete
                            ? "text-white"
                            : worstSeverity === "error"
                            ? "text-white"
                            : "text-foreground"
                        }`}
                      >
                        {worstSeverity === "error" ? "✕" : "!"}&nbsp;
                        {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
                      </span>
                      <span
                        className={`text-[8px] font-medium uppercase tracking-widest ${
                          isComplete
                            ? "text-white/40"
                            : worstSeverity === "error"
                            ? "text-white/40"
                            : "text-foreground/30"
                        }`}
                      >
                        ⚗ chemist
                      </span>
                    </div>
                  </div>
                )}

                {/* Analyzing indicator */}
                {isAnalyzing && filled > 0 && !worstSeverity && (
                  <p
                    className={`mb-3 text-[8px] font-medium uppercase tracking-widest ${
                      isComplete ? "text-white/30" : "text-foreground/20"
                    }`}
                  >
                    ⚗ analyzing…
                  </p>
                )}

                {/* Compatible badge — all filled products in this group analyzed with no conflicts */}
                {!quotaExceeded && !isAnalyzing && !worstSeverity && filled > 0 &&
                  group.categories
                    .filter((cat) => filledSlots[cat])
                    .every((cat) => analyzedIds.has(filledSlots[cat])) && (
                  <div className="mb-3">
                    <div
                      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 ${
                        isComplete ? "border-white/20" : "border-foreground/15"
                      }`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${
                          isComplete ? "text-white/50" : "text-foreground/35"
                        }`}
                      >
                        ✓ compatible
                      </span>
                      <span
                        className={`text-[8px] font-medium uppercase tracking-widest ${
                          isComplete ? "text-white/25" : "text-foreground/20"
                        }`}
                      >
                        ⚗ chemist
                      </span>
                    </div>
                  </div>
                )}

                {/* Fill count bar */}
                <div className="mt-auto">
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.15em] ${
                        isComplete ? "text-white/50" : "text-foreground/30"
                      }`}
                    >
                      {filled} / {total} selected
                    </span>
                  </div>
                  <div
                    className={`h-0.5 w-full ${
                      isComplete ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`h-0.5 transition-all duration-300 ${
                        isComplete ? "bg-white" : "bg-foreground"
                      }`}
                      style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
