/**
 * Shared helpers for reading/writing buildSlots in localStorage.
 *
 * Slot index format (key: "buildSlots"):
 *   Record<string, string>  — category key → product ID
 *
 * Product cache (key: "buildProductCache"):
 *   Record<string, Product> — product ID → full Product object
 *   Written whenever a product is selected so the group page can
 *   display product details without an API round-trip.
 */

import type { Product } from "@/types";

const SLOTS_KEY = "buildSlots";
const CACHE_KEY = "buildProductCache";

// ---------------------------------------------------------------------------
// Slot index
// ---------------------------------------------------------------------------

export function readBuildSlots(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    // Already the correct flat format
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }

    // Migrate old array format: [{ category, product: Product }]
    if (Array.isArray(parsed)) {
      const migrated: Record<string, string> = {};
      const productCache: Record<string, Product> = {};
      for (const entry of parsed) {
        if (entry?.category && entry?.product?.id) {
          migrated[entry.category] = entry.product.id;
          productCache[entry.product.id] = entry.product;
        }
      }
      localStorage.setItem(SLOTS_KEY, JSON.stringify(migrated));
      // Persist product objects rescued from the old format
      if (Object.keys(productCache).length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(productCache));
      }
      return migrated;
    }

    return {};
  } catch {
    return {};
  }
}

export function saveBuildSlot(category: string, productId: string): void {
  const slots = readBuildSlots();
  slots[category] = productId;
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

export function removeBuildSlot(category: string): void {
  const slots = readBuildSlots();
  delete slots[category];
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

// ---------------------------------------------------------------------------
// Product cache
// ---------------------------------------------------------------------------

export function readBuildProductCache(): Record<string, Product> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Product>) : {};
  } catch {
    return {};
  }
}

export function saveBuildProductToCache(productId: string, product: Product): void {
  if (typeof window === "undefined") return;
  try {
    const cache = readBuildProductCache();
    cache[productId] = product;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

const PRODUCT_CACHE_KEY = "buildProductCache";

export function readBuildProductCache(): Record<string, import("@/types").Product> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveBuildProductToCache(productId: string, product: import("@/types").Product): void {
  const cache = readBuildProductCache();
  cache[productId] = product;
  localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(cache));
}
