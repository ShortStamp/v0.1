"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CompatibilityInfo } from "@/types";

// ---------------------------------------------------------------------------
// DebugModeIndicator — floating pill shown while debug mode is active
// ---------------------------------------------------------------------------

export function DebugModeIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9998] flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 shadow-lg">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/70">
        Debug · Shift+D
      </span>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// ConflictBadge — click-to-toggle panel with portal rendering.
// The panel is portalled to document.body so it is never clipped by
// overflow-hidden ancestors on tile cards.
// ---------------------------------------------------------------------------

interface ConflictBadgeProps {
  compat: CompatibilityInfo;
  resolveName: (id: string) => string;
  position?: "above" | "below";
  debugMode?: boolean;
}

export function ConflictBadge({ compat, resolveName, position = "above", debugMode = false }: ConflictBadgeProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Compute position from the badge's bounding rect
  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = 288; // w-72 = 18rem = 288px
    // Centre horizontally on the badge, clamp to viewport
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    if (position === "above") {
      setCoords({ top: rect.top + window.scrollY - 8, left });
    } else {
      setCoords({ top: rect.bottom + window.scrollY + 8, left });
    }
  }, [position]);

  // Reposition on open and on scroll/resize
  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isError = compat.severity === "error";
  const isInfo = compat.severity === "info";

  // Human-friendly mapping for source agents
  const sourceLabels: Record<string, string> = {
    chemist: "Ingredient Compatibility",
    artist: "Makeup Artistry",
    trend: "Trend Alignment",
    orchestrator: "System Analysis",
  };
  const sourceLabel = sourceLabels[compat.sourceAgent] || "Expert Analysis";

  const allReasons = compat.reasons && compat.reasons.length > 0 
    ? compat.reasons 
    : [{ agent: compat.sourceAgent, text: compat.reason, severity: compat.severity }];

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] font-sans transition-all ${
          isError
            ? "bg-red-500 text-white hover:bg-red-600"
            : isInfo
              ? "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100"
              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
        }`}
      >
        {isError ? "✕ Conflict" : isInfo ? "ℹ Note" : "! Warning"}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] w-72 rounded-2xl border border-border/50 bg-white p-4 shadow-2xl"
          style={{
            top: coords.top,
            left: coords.left,
            transform: position === "above" ? "translateY(-100%)" : undefined,
          }}
        >
          {/* Conflicting products */}
          {compat.conflictingProductIds.length > 0 && (
            <div className="mb-3 pb-3 border-b border-border/20">
              <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-foreground/40 font-sans">
                Conflicts with
              </p>
              <div className="flex flex-col gap-1">
                {compat.conflictingProductIds.map((id) => (
                  <p key={id} className="text-[10px] font-bold text-foreground font-sans leading-snug">
                    {resolveName(id)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* All Reasons / Agent Opinions */}
          <div className="flex flex-col gap-4">
            {allReasons.map((r, i) => (
              <div key={i} className="space-y-1">
                <p className={`text-[7px] font-bold uppercase tracking-widest font-sans ${
                  r.severity === "error" ? "text-red-500" : r.severity === "info" ? "text-blue-500" : "text-amber-600"
                }`}>
                  {sourceLabels[r.agent] || "Expert Analysis"}
                </p>
                <p className="text-[10px] font-medium leading-relaxed text-foreground font-sans">
                  {r.text}
                </p>
              </div>
            ))}
          </div>

          {/* Debug trace — only shown in Shift+D debug mode */}
          {debugMode && (
            <DebugTrace trace={compat.debugTrace} initialExpanded={true} />
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DebugTrace — collapsible trace panel (internal)
// ---------------------------------------------------------------------------

function DebugTrace({ trace, initialExpanded = false }: { trace: string[]; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);

  if (!trace || trace.length === 0) return null;

  const humanizeLine = (line: string) => {
    return line
      .replace(/^FORMULA:/i, "🧪 Formula:")
      .replace(/^INCI/i, "📋 Ingredients:")
      .replace(/^MATCH:/i, "🔍 Match Found:")
      .replace(/^SKIP/i, "⏩ Skipped:")
      .replace(/^DOWNGRADE/i, "⚠️ Downgraded:")
      .replace(/^KILLED/i, "✅ Resolved:")
      .replace(/^VERDICT:/i, "🚩 Final Verdict:")
      .replace(/^LLM ADDED/i, "🤖 AI Insight:")
      .replace(/^LLM STRIPPED/i, "🤖 AI Refined:")
      .replace(/^SKIN-TYPE/i, "🧴 Skin Type:")
      .replace(/^PHYSICAL/i, "✨ Texture/Physical:")
      .replace(/^ARTIST/i, "🎨 Artistry:")
      .replace(/^ORCHESTRATOR/i, "⚙️ System:")
      .replace(/PASS:/i, "✅ PASS:");
  };

  return (
    <div className="mt-2 border-t border-border/20 pt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex w-full items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-foreground/30 hover:text-foreground/60 transition-colors font-sans"
      >
        <span
          className="transition-transform duration-200 inline-block"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        System Analysis ({trace.length})
      </button>
      {expanded && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-foreground/[0.03] p-2">
          {trace.map((line, i) => {
            let color = "text-foreground/50";
            if (line.startsWith("FORMULA:")) color = "text-blue-500";
            else if (line.startsWith("INCI")) color = "text-foreground/40";
            else if (line.startsWith("MATCH:")) color = "text-orange-500";
            else if (line.startsWith("SKIP")) color = "text-green-500";
            else if (line.startsWith("DOWNGRADE")) color = "text-amber-500";
            else if (line.startsWith("KILLED")) color = "text-green-600 font-bold";
            else if (line.startsWith("VERDICT:")) color = "text-red-500 font-bold";
            else if (line.startsWith("LLM ADDED")) color = "text-purple-500";
            else if (line.startsWith("LLM STRIPPED")) color = "text-green-500";
            else if (line.startsWith("SKIN-TYPE")) color = "text-cyan-500";
            else if (line.startsWith("PHYSICAL")) color = "text-indigo-500";
            else if (line.startsWith("ARTIST")) color = "text-pink-500";
            else if (line.startsWith("ORCHESTRATOR")) color = "text-violet-500";
            else if (line.includes("PASS:")) color = "text-green-600";

            return (
              <p key={i} className={`font-mono text-[8px] leading-relaxed ${color}`}>
                {humanizeLine(line)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// PassBadge — shown for compatible products when debug mode is on
// ---------------------------------------------------------------------------

interface PassBadgeProps {
  trace: string[];
  position?: "above" | "below";
}

export function PassBadge({ trace, position = "above" }: PassBadgeProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = 288;
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    if (position === "above") {
      setCoords({ top: rect.top + window.scrollY - 8, left });
    } else {
      setCoords({ top: rect.bottom + window.scrollY + 8, left });
    }
  }, [position]);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasTrace = trace && trace.length > 0;

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="rounded-full bg-green-50 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-green-600 border border-green-100 font-sans hover:bg-green-100 transition-colors"
      >
        ✓ Compatible {hasTrace ? "▶" : ""}
      </button>

      {open && hasTrace && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] w-72 rounded-2xl border border-border/50 bg-white p-4 shadow-2xl"
          style={{
            top: coords.top,
            left: coords.left,
            transform: position === "above" ? "translateY(-100%)" : undefined,
          }}
        >
          <p className="mb-2 text-[7px] font-bold uppercase tracking-widest text-foreground/40 font-sans">
            Compatibility Analysis
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-foreground/[0.03] p-2">
            {trace.map((line, i) => {
              let color = "text-green-600";
              if (line.startsWith("FORMULA:")) color = "text-blue-500";
              else if (line.startsWith("INCI")) color = "text-foreground/40";
              else if (line.startsWith("TREND PASS")) color = "text-teal-500";
              else if (line.startsWith("ARTIST PASS")) color = "text-pink-500";
              else if (line.startsWith("CHEMIST PASS")) color = "text-blue-500";

              // Reuse the humanize logic or just use a simpler one here
              const humanLine = line
                .replace(/^FORMULA:/i, "🧪 Formula:")
                .replace(/^INCI/i, "📋 Ingredients:")
                .replace(/^TREND PASS/i, "📈 Trend:")
                .replace(/^ARTIST PASS/i, "🎨 Artistry:")
                .replace(/^CHEMIST PASS/i, "🧪 Chemistry:");

              return (
                <p key={i} className={`font-mono text-[8px] leading-relaxed ${color}`}>
                  {humanLine}
                </p>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
