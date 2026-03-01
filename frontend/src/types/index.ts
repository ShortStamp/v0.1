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

export interface ProductVariant {
  shadeName?: string;
  hexColor?: string;
  imageUrl?: string;
  price?: number;
  isDefault?: boolean;
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
  inciIngredients?: string[];
  extraImageUrls?: string[];
  variants?: ProductVariant[];
}

export interface RetailerPrice {
  retailer: string;
  retailerLogo?: string;
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
  concerns?: string[];
}

export interface CompatibilityReason {
  agent: string;
  text: string;
  severity: "warning" | "error" | "info";
}

export interface CompatibilityInfo {
  isCompatible: boolean;
  reason: string;
  reasons: CompatibilityReason[];
  severity: "warning" | "error" | "info";
  sourceAgent: string;
  conflictingProductIds: string[];
  debugTrace: string[];
}

export interface BlueprintStep {
  step_number: number;
  category: string;
  product_id: string;
  product_name: string;
  insight: string;
}

export interface ArtistNote {
  title: string;
  content: string;
  severity: "info" | "warning" | "success";
}

export interface SafetyCheck {
  label: string;
  description: string;
  passed: boolean;
}

export interface MakeupRecipeCard {
  stability_index: number;
  status_label: "Compatible" | "Warning: Texture Clash" | "Incompatible: Physical Failure";
  blueprint: BlueprintStep[];
  artist_notes: ArtistNote[];
  safety_audit: SafetyCheck[];
  missing_links: string[];
  missing_category_keys: string[];
  share_fingerprint: string;
}

export type CompatibilityMap = Record<string, CompatibilityInfo>;
