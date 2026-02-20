"use client";

import { useState, useEffect } from "react";
import type { CompatibilityMap } from "@/types";

/**
 * Calls POST /api/v1/compatibility/analyze whenever the set of filled product IDs
 * changes (minimum 2 products required for a meaningful analysis).
 *
 * Returns:
 *  - compatibilityMap — products with detected conflicts (keyed by product ID)
 *  - analyzedIds      — set of product IDs included in the last completed analysis;
 *                       a product absent from compatibilityMap but present here is
 *                       confirmed compatible by the chemist agent
 *  - isAnalyzing      — true while the request is in-flight
 *  - quotaExceeded    — true when the backend received a 429 from the Gemini API;
 *                       rule-based results may still be present in compatibilityMap
 */
export function useCompatibility(filledSlots: Record<string, string>) {
  const [compatibilityMap, setCompatibilityMap] = useState<CompatibilityMap>({});
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Stable dep key: sorted product IDs joined — avoids re-runs on reference changes
  const depKey = Object.values(filledSlots).filter(Boolean).sort().join(",");

  useEffect(() => {
    const productIds = depKey ? depKey.split(",") : [];

    if (productIds.length < 2) {
      setCompatibilityMap({});
      setAnalyzedIds(new Set());
      setQuotaExceeded(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzing(true);
    setQuotaExceeded(false);

    // Read beauty profile from localStorage for Artist Agent analysis
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
        };
      } catch { return null; }
    })();

    fetch("/api/v1/compatibility/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        build_id: "local-build",
        user_id: "local-user",
        product_ids: productIds,
        beauty_profile: beautyProfile,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;

        const map: CompatibilityMap = {};
        for (const [productId, raw] of Object.entries(
          (data.compatibility_map ?? {}) as Record<string, any>
        )) {
          map[productId] = {
            isCompatible: raw.is_compatible,
            reason: raw.reason,
            severity: raw.severity,
            sourceAgent: raw.source_agent,
            conflictingProductIds: raw.conflicting_product_ids ?? [],
          };
        }
        setCompatibilityMap(map);
        setAnalyzedIds(new Set(productIds));

        // Surface quota error signalled by the backend
        const errors: string[] = data.errors ?? [];
        setQuotaExceeded(errors.includes("quota_exceeded"));
      })
      .catch(() => {
        // Silently degrade — no badge shown if backend is unreachable
        if (!cancelled) {
          setCompatibilityMap({});
          setQuotaExceeded(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return { compatibilityMap, analyzedIds, isAnalyzing, quotaExceeded };
}
