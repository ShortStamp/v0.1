"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CompatibilityInfo } from "@/types";

// ---------------------------------------------------------------------------
// ConflictBadge — click-to-toggle panel with portal rendering.
// The panel is portalled to document.body so it is never clipped by
// overflow-hidden ancestors on tile cards.
// ---------------------------------------------------------------------------

interface ConflictBadgeProps {
  compat: CompatibilityInfo;
  resolveName: (id: string) => string;
  position?: "above" | "below";
}

export function ConflictBadge({ compat, resolveName, position = "above" }: ConflictBadgeProps) {
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

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] font-sans transition-all ${
          isError
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
        }`}
      >
        {isError ? "✕ Conflict" : "! Warning"}
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
          {/* Source agent tag */}
          <p className="mb-2 text-[7px] font-bold uppercase tracking-widest text-foreground/25 font-sans">
            Source: {compat.sourceAgent}
          </p>

          {/* Conflicting products */}
          {compat.conflictingProductIds.length > 0 && (
            <div className="mb-2 pb-2 border-b border-border/20">
              <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-foreground/40 font-sans">
                Conflicts with
              </p>
              {compat.conflictingProductIds.map((id) => (
                <p key={id} className="text-[10px] font-bold text-foreground font-sans leading-snug">
                  {resolveName(id)}
                </p>
              ))}
            </div>
          )}

          {/* Reason */}
          <p className="text-[10px] font-medium leading-relaxed text-foreground font-sans">
            {compat.reason}
          </p>

          {/* Debug trace */}
          <DebugTrace trace={compat.debugTrace} />
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DebugTrace — collapsible trace panel (internal)
// ---------------------------------------------------------------------------

function DebugTrace({ trace }: { trace: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!trace || trace.length === 0) return null;

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
        Debug Trace ({trace.length})
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

            return (
              <p key={i} className={`font-mono text-[8px] leading-relaxed ${color}`}>
                {line}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
