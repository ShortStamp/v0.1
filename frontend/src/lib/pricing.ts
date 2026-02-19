import { Product, RetailerPrice } from "@/types";

export function hasKnownPrice(price: RetailerPrice): boolean {
  return Number.isFinite(price.price) && price.price > 0;
}

export function getPricedOffers(prices: RetailerPrice[]): RetailerPrice[] {
  return prices.filter(hasKnownPrice).sort((a, b) => a.price - b.price);
}

export function getBestOffer(prices: RetailerPrice[]): RetailerPrice | null {
  const priced = getPricedOffers(prices);
  return priced[0] || null;
}

export function formatPrice(value: number | null | undefined): string {
  if (!value || value <= 0) return "See retailer";
  return `$${value.toFixed(2)}`;
}

export function getDisplayBrand(brand: string | null | undefined): string {
  if (!brand) return "Unknown";
  const trimmed = brand.trim();
  return trimmed.length > 0 ? trimmed : "Unknown";
}

export function getDisplayName(name: string | null | undefined): string {
  if (!name) return "Product";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Product";
}

export function getBestOfferForProduct(product: Product): RetailerPrice | null {
  return getBestOffer(product.prices || []);
}
