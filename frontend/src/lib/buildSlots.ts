/**
 * Shared helpers for reading/writing buildSlots in localStorage.
 * Format: flat Record<string, string> mapping category key → product ID.
 *
 * Handles migration from the old array-of-objects format that the category
 * page used to write: [{ category: string, product: { id: string, ... } }]
 */

export function readBuildSlots(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("buildSlots");
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    // Already the correct flat format
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    // Migrate old array format: [{ category, product }]
    if (Array.isArray(parsed)) {
      const migrated: Record<string, string> = {};
      for (const entry of parsed) {
        if (entry?.category && entry?.product?.id) {
          migrated[entry.category] = entry.product.id;
        }
      }
      // Persist migrated format
      localStorage.setItem("buildSlots", JSON.stringify(migrated));
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
  localStorage.setItem("buildSlots", JSON.stringify(slots));
}

export function removeBuildSlot(category: string): void {
  const slots = readBuildSlots();
  delete slots[category];
  localStorage.setItem("buildSlots", JSON.stringify(slots));
}
