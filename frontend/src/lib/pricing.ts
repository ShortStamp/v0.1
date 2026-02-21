import { Product, RetailerPrice } from "@/types";

export function formatPrice(price?: number): string {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
}

export function getBestOffer(prices: RetailerPrice[]): RetailerPrice | undefined {
  const inStock = prices.filter((p) => p.inStock);
  const pool = inStock.length > 0 ? inStock : prices;
  if (pool.length === 0) return undefined;
  return pool.reduce((best, cur) => (cur.price < best.price ? cur : best));
}

export function getBestOfferForProduct(product: Product): RetailerPrice | undefined {
  return getBestOffer(product.prices ?? []);
}

export function getDisplayBrand(brand: string): string {
  if (!brand) return "";
  return brand
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getDisplayName(name: string): string {
  if (!name) return "";
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
