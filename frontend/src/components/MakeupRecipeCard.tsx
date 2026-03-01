"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, AlertTriangle, Share2, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import type { MakeupRecipeCard as RecipeCardType } from "@/types";
import { saveBuildSlot, saveBuildProductToCache, readBuildSlots } from "@/lib/buildSlots";

interface MakeupRecipeCardProps {
  recipe: RecipeCardType;
  overallScore: number;
}

export function MakeupRecipeCard({ recipe, overallScore }: MakeupRecipeCardProps) {
  const router = useRouter();
  const [isFilling, setIsFilling] = useState(false);
  const stabilityPercentage = Math.round(overallScore * 100);
  
  // Status color mapping
  const statusColors = {
    "Compatible": "text-green-600 bg-green-50 border-green-100",
    "Warning: Texture Clash": "text-amber-600 bg-amber-50 border-amber-100",
    "Incompatible: Physical Failure": "text-red-600 bg-red-50 border-red-100",
  };

  const statusColor = statusColors[recipe.status_label] || "text-foreground/40 bg-muted border-border/50";

  const onFillGaps = async () => {
    if (!recipe.missing_category_keys || recipe.missing_category_keys.length === 0) return;
    
    setIsFilling(true);
    try {
      const currentSlots = readBuildSlots();
      const currentProductIds = Object.values(currentSlots).filter(Boolean);
      
      // Read beauty profile from localStorage
      const beautyProfile = (() => {
        try {
          const raw = localStorage.getItem("beautyProfile");
          if (!raw) return null;
          const p = JSON.parse(raw);
          return {
            skin_tone: p.skinTone || null,
            undertone: p.undertone || null,
            skin_type: p.skinType || null,
            coverage: p.coverage || null,
            finish: p.finish || null,
            budget: p.budget || null,
            concerns: Array.isArray(p.concerns) ? p.concerns : [],
          };
        } catch { return null; }
      })();

      const response = await fetch("/api/v1/compatibility/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_product_ids: currentProductIds,
          missing_category_keys: recipe.missing_category_keys,
          beauty_profile: beautyProfile,
        }),
      });

      if (!response.ok) throw new Error("Auto-fill failed");
      
      const data = await response.json();
      
      // Add all suggestions to build
      data.suggestions.forEach((suggestion: any) => {
        saveBuildSlot(suggestion.category, suggestion.product_id);
        saveBuildProductToCache(suggestion.product_id, suggestion.product_data);
      });

      // Reload to trigger compatibility re-analysis and show the complete recipe
      window.location.reload();
    } catch (err) {
      console.error("Failed to auto-fill gaps:", err);
      // Fallback to manual navigation if auto-fill fails
      const firstMissing = recipe.missing_category_keys[0];
      router.push(`/build/category/${firstMissing}`);
    } finally {
      setIsFilling(false);
    }
  };

  return (
    <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="overflow-hidden rounded-[2.5rem] border border-border/50 bg-white shadow-2xl shadow-accent/10">
        
        {/* 1. Stability & Harmony Index (Hero Header) */}
        <div className="relative border-b border-border/30 bg-gradient-to-br from-white to-pink-soft/20 p-10 sm:p-12">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="space-y-4 text-center md:text-left">
              <div className={`inline-block rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] font-sans ${statusColor}`}>
                {recipe.status_label}
              </div>
              <h2 className="text-4xl font-bold font-serif tracking-tight">Logic of the Face</h2>
              <p className="max-w-md text-sm leading-relaxed text-foreground/50 font-sans font-light">
                Your personalized makeup recipe card, validated by our aesthetic and chemical agents for maximum wear and visual harmony.
              </p>
            </div>

            {/* Circular Gauge */}
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle
                  className="text-muted/30 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-accent stroke-current transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - overallScore)}
                  strokeLinecap="round"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold font-sans tracking-tight">{stabilityPercentage}%</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Stability Index</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12">
          {/* Left Column: Blueprint */}
          <div className="lg:col-span-7 border-r border-border/30 p-10 sm:p-12">
            <div className="mb-10 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground font-sans">Application Blueprint</h3>
              <span className="text-[10px] font-medium text-foreground/30 font-sans italic">Layering Order Optimized</span>
            </div>

            <div className="space-y-6">
              {recipe.blueprint.map((step) => (
                <div key={step.step_number} className="group relative flex gap-6 rounded-2xl border border-transparent p-4 transition-all hover:bg-muted/30 hover:border-border/30">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/40 font-serif text-lg font-bold transition-colors group-hover:bg-accent group-hover:text-white">
                    {String(step.step_number).padStart(2, '0')}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-accent font-sans">{step.category}</span>
                      <h4 className="text-sm font-bold text-foreground font-sans leading-tight">{step.product_name}</h4>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/60 font-sans font-light">
                      <span className="font-bold text-foreground/40 italic mr-1">Insight:</span>
                      {step.insight}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Artist Notes & Safety Audit */}
          <div className="lg:col-span-5 bg-muted/10 p-10 sm:p-12">
            
            {/* 2. Artist's Notes */}
            <div className="mb-12">
              <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.3em] text-foreground font-sans">Artist&apos;s Notes</h3>
              <div className="space-y-6">
                {recipe.artist_notes.map((note, i) => (
                  <div key={i} className="rounded-2xl border border-border/30 bg-white p-6 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      {note.severity === "success" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : note.severity === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Info className="h-4 w-4 text-accent" />
                      )}
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 font-sans">{note.title}</h4>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground font-sans font-medium">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Chemical Safety Audit */}
            <div className="mb-12">
              <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.3em] text-foreground font-sans">Chemical Safety Audit</h3>
              <div className="space-y-4 rounded-3xl bg-foreground/5 p-6">
                {recipe.safety_audit.map((check, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${check.passed ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                      {check.passed ? <Check className="h-3 w-3 stroke-[3]" /> : <span className="text-[10px] font-bold">!</span>}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-bold font-sans text-foreground">{check.label}</h4>
                      <p className="text-[10px] leading-relaxed text-foreground/50 font-sans font-light">
                        {check.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Missing Link Callout */}
            {recipe.missing_links.length > 0 && (
              <div className="rounded-3xl border-2 border-dashed border-accent/20 bg-accent/[0.02] p-6">
                <div className="mb-4 flex items-center gap-2 text-accent">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-sans">Recommended Additions</h3>
                </div>
                <div className="space-y-4">
                  {recipe.missing_links.map((link, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <p className="text-xs font-medium text-foreground/70 font-sans italic leading-relaxed">
                        {link}
                      </p>
                    </div>
                  ))}
                  <button 
                    onClick={onFillGaps}
                    disabled={isFilling}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-white shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFilling ? (
                      <>Completing Build... <Loader2 className="h-3 w-3 animate-spin" /></>
                    ) : (
                      <>Fill the Gaps <ArrowRight className="h-3 w-3" /></>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons (Footer) */}
        <div className="flex flex-col gap-px border-t border-border/30 sm:flex-row">
          <button className="group flex flex-1 items-center justify-center gap-3 bg-white py-8 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-all hover:bg-muted/50 font-sans">
            <Share2 className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
            Export to MUA
          </button>
          <div className="h-px w-full bg-border/30 sm:h-auto sm:w-px" />
          <button className="group flex flex-1 items-center justify-center gap-3 bg-foreground py-8 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-black font-sans">
            <ShoppingBag className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
            Buy My Set
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal Sparkles icon since Lucide import failed in this thought
function Sparkles({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
