export type OwnedProduct = {
  id: string;
  name: string;
  brand: string;
  image: string;
  offerUrl?: string;
};

const KEY = "ownedProducts";

export function readOwnedProducts(): OwnedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addOwnedProduct(p: OwnedProduct): void {
  if (typeof window === "undefined") return;
  const current = readOwnedProducts();
  if (current.some((o) => o.id === p.id)) return;
  localStorage.setItem(KEY, JSON.stringify([...current, p]));
}

export function removeOwnedProduct(id: string): void {
  if (typeof window === "undefined") return;
  const current = readOwnedProducts();
  localStorage.setItem(KEY, JSON.stringify(current.filter((o) => o.id !== id)));
}
