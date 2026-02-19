export type CategoryKey =
  | "foundation"
  | "concealer"
  | "primer"
  | "powder"
  | "blush"
  | "bronzer"
  | "highlighter"
  | "contour"
  | "eyeshadow"
  | "eyeliner"
  | "mascara"
  | "false-lashes"
  | "brow-pencil"
  | "brow-gel"
  | "lipstick"
  | "lip-gloss"
  | "lip-liner"
  | "setting-spray";

export interface CategoryGroup {
  key: string;
  label: string;
  categories: CategoryKey[];
}

export interface ProductFilter {
  key: string;
  label: string;
  type: "checkbox" | "range";
  options?: string[];
}

export interface CategoryDefinition {
  key: CategoryKey;
  label: string;
  filters: ProductFilter[];
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  image: string;
  category: CategoryKey;
  stampScore: number;
  prices: RetailerPrice[];
  description?: string;
  specs?: string[];
  reviews?: Review[];
  walmartUrl?: string;
  filters: Record<string, string | boolean | number>;
}

export interface RetailerPrice {
  retailer: string;
  price: number;
  url: string;
  inStock: boolean;
}

export interface Review {
  author: string;
  rating: number;
  text: string;
}

export interface Trend {
  id: string;
  name: string;
  image: string;
  stampScore: number;
  description: string;
  direction: "rising" | "stable" | "declining";
  products: Product[];
  videos?: { title: string; url: string }[];
  articles?: { title: string; url: string }[];
}

export interface ToolboxSlot {
  category: CategoryKey;
  product: Product | null;
}

export interface BeautyProfile {
  skinTone: string;
  undertone: string;
  skinType: string;
  coverage: string;
  finish: string;
  budget: string;
}
