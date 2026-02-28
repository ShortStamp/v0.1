"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ss_debug_mode";

/**
 * Global debug mode toggle.
 *
 * - Keyboard shortcut: Shift+D (toggles on/off)
 * - Persisted in localStorage so it survives page navigation
 * - When ON: compatible products show a clickable trace badge revealing every
 *   decision each agent made, including all passing checks
 */
export function useDebugMode(): boolean {
  const [debugMode, setDebugMode] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      setDebugMode(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable (e.g. private browsing with storage blocked)
    }
  }, []);

  // Shift+D keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't fire inside text inputs
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.shiftKey && e.key === "D") {
        setDebugMode((prev) => {
          const next = !prev;
          try {
            localStorage.setItem(STORAGE_KEY, String(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return debugMode;
}
