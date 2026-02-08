export interface Product {
  id: string;
  name: string;
  brand: string;
  image: string;
  category: string;
  region: FaceRegion;
  stampScore: number;
  prices: RetailerPrice[];
  description?: string;
  specs?: string[];
  reviews?: Review[];
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
  videos?: string[];
  articles?: { title: string; url: string }[];
}

export type FaceRegion = "eyes" | "lips" | "cheeks" | "brows" | "skin" | "lashes";

export interface FaceCategory {
  region: FaceRegion;
  label: string;
  categories: string[];
}

export interface ToolboxSlot {
  region: FaceRegion;
  product: Product | null;
}
