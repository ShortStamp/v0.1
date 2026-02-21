import { api } from "./api";

// ---- Types ----

export interface AdminStats {
  total_products: number;
  active_products: number;
  products_by_category: Record<string, number>;
  total_brands: number;
}

export interface AdminPriceRow {
  id: number;
  retailer: string | null;
  source: string | null;
  price: number;
  url: string;
  in_stock: boolean;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  image_url: string;
  stamp_score: number;
  is_active: boolean;
  source: string;
  walmart_item_id: string | null;
  amazon_asin: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProductDetail extends AdminProductListItem {
  description: string | null;
  specs: string[] | null;
  inci_ingredients: string[] | null;
  prices: AdminPriceRow[];
}

export interface PaginatedAdminProducts {
  items: AdminProductListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface AdminBrand {
  id: number;
  name: string;
}

export interface AdminProductCreate {
  name: string;
  brand: string;
  category_key: string;
  image_url?: string;
  description?: string | null;
  specs?: string[] | null;
  inci_ingredients?: string[] | null;
}

export interface AdminProductUpdate {
  name?: string;
  brand?: string;
  category_key?: string;
  image_url?: string;
  description?: string | null;
  specs?: string[] | null;
  inci_ingredients?: string[] | null;
  is_active?: boolean;
}

export interface AdminPriceCreate {
  retailer: string;
  url: string;
  price: number;
  in_stock?: boolean;
}

export interface AdminPriceUpdate {
  retailer?: string;
  url?: string;
  price?: number;
  in_stock?: boolean;
}

export interface AdminProductsParams {
  search?: string;
  category?: string;
  source?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
  sort?: string;
}

// ---- Raw fetch helper ----

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Use the existing api singleton's private fetch by delegating through its public methods.
  // Since we need arbitrary paths with PATCH/DELETE, we call the underlying fetch directly.
  // The api class exposes `fetch` indirectly — we replicate it here using the token from localStorage.
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`/api/v1${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `API error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      qs.set(k, String(v));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ---- Admin API client ----

export const adminApi = {
  getStats: () => adminFetch<AdminStats>("/admin/stats"),

  getProducts: (params: AdminProductsParams = {}) =>
    adminFetch<PaginatedAdminProducts>(
      `/admin/products${toQueryString(params as Record<string, string | number | boolean | undefined>)}`
    ),

  createProduct: (data: AdminProductCreate) =>
    adminFetch<AdminProductDetail>("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getProduct: (id: string) => adminFetch<AdminProductDetail>(`/admin/products/${id}`),

  updateProduct: (id: string, data: AdminProductUpdate) =>
    adminFetch<AdminProductDetail>(`/admin/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    adminFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),

  getBrands: () => adminFetch<AdminBrand[]>("/admin/brands"),

  addPrice: (productId: string, data: AdminPriceCreate) =>
    adminFetch<AdminPriceRow>(`/admin/products/${productId}/prices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePrice: (productId: string, priceId: number, data: AdminPriceUpdate) =>
    adminFetch<AdminPriceRow>(`/admin/products/${productId}/prices/${priceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePrice: (productId: string, priceId: number) =>
    adminFetch<void>(`/admin/products/${productId}/prices/${priceId}`, {
      method: "DELETE",
    }),
};
