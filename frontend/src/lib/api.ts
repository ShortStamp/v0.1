import type {
  BeautyProfile,
  CategoryGroup,
  CategoryDefinition,
  Product,
  RetailerPrice,
  Trend,
  CategoryKey,
} from "@/types";

const API_URL = "/api/v1";

interface RawCategory {
  key: CategoryKey;
  label: string;
  group_key: string;
  filters: Array<{ key: string; label: string; type: string; options?: string[] }>;
}

interface RawCategoryGroup {
  key: string;
  label: string;
  categories: RawCategory[];
}

interface RawProduct {
  id: string;
  name: string;
  brand: string;
  image?: string;
  category: CategoryKey;
  stamp_score: number;
  prices: RawRetailerPrice[];
  description?: string;
  specs?: string[];
  reviews?: Array<{ author: string; rating: number; text: string }>;
  walmart_url?: string;
  filters?: Record<string, string>;
}

interface RawRetailerPrice {
  retailer: string;
  retailer_logo?: string;
  price: number;
  url: string;
  in_stock: boolean;
}

interface RawTrend {
  id: string;
  name: string;
  image?: string;
  stamp_score: number;
  description?: string;
  direction?: "rising" | "stable" | "declining";
  products?: RawProduct[];
  videos?: Array<{ title?: string; url: string }>;
  articles?: Array<{ title: string; url: string }>;
}

interface RawQuizQuestion {
  key: string;
  title: string;
  subtitle: string;
  options: Array<{ value: string; label: string; description: string; icon: string }>;
}

interface RawBeautyProfile {
  skin_tone?: string;
  undertone?: string;
  skin_type?: string;
  coverage?: string;
  finish?: string;
  budget?: string;
}

interface RawUserStyles {
  styles: string[];
}

interface RawUserNotifications {
  enabled: boolean;
}

interface RawBuild {
  id: string;
  name: string;
  user_id: string;
  slots: Array<{ category_key: CategoryKey; product_id: string }>;
  created_at: string;
  updated_at: string;
}

interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface ProductFilterPropertiesResponse {
  filters: Record<string, string[]>;
  counts: Record<string, Record<string, number>>;
}

interface AuthResponse {
  user: { id: string; email: string; display_name: string | null; is_admin: boolean };
  access_token: string;
  refresh_token: string;
}

class ApiClient {
  private accessToken: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("accessToken");
    }
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
        if (!retry.ok) throw new Error(`API error: ${retry.status}`);
        return retry.json();
      }
      this.clearTokens();
      throw new Error("Session expired");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(", ")
          : `API error: ${res.status}`;
      throw new Error(message);
    }

    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== "undefined"
      ? localStorage.getItem("refreshToken")
      : null;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data: AuthResponse = await res.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);
    }
  }

  clearTokens() {
    this.accessToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // ---- Auth ----

  async signup(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const data = await this.fetch<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.fetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async oauthGoogle(idToken: string): Promise<AuthResponse> {
    const data = await this.fetch<AuthResponse>("/auth/oauth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async oauthApple(idToken: string, user?: object): Promise<AuthResponse> {
    const data = await this.fetch<AuthResponse>("/auth/oauth/apple", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, user: user || null }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.fetch("/auth/logout", { method: "POST" });
    } finally {
      this.clearTokens();
    }
  }

  async getMe(): Promise<AuthResponse["user"]> {
    return this.fetch("/auth/me");
  }

  // ---- Categories ----

  async getCategoryGroups(): Promise<CategoryGroup[]> {
    const groups = await this.fetch<RawCategoryGroup[]>("/categories/groups");
    return groups.map((g) => ({
      key: g.key,
      label: g.label,
      categories: g.categories.map((c) => c.key),
    }));
  }

  async getCategory(key: string): Promise<CategoryDefinition> {
    return this.fetch(`/categories/${key}`);
  }

  // ---- Products ----

  async getProducts(params: {
    category?: string;
    search?: string;
    filters?: Record<string, string>;
    sort?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedProducts> {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set("category", params.category);
    if (params.search) searchParams.set("search", params.search);
    if (params.sort) searchParams.set("sort", params.sort);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.per_page) searchParams.set("per_page", String(params.per_page));
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        searchParams.set(`filters[${key}]`, value);
      }
    }

    const data = await this.fetch<{
        items: RawProduct[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
    }>(`/products?${searchParams}`);
    return {
      ...data,
      items: data.items.map(mapProduct),
    };
  }

  async getProduct(id: string): Promise<Product> {
    const data = await this.fetch<RawProduct>(`/products/${id}`);
    return mapProduct(data);
  }

  async getProductBrands(category?: string): Promise<string[]> {
    const searchParams = new URLSearchParams();
    if (category) searchParams.set("category", category);
    const query = searchParams.toString();
    return this.fetch(`/products/brands${query ? `?${query}` : ""}`);
  }

  async getProductPrices(id: string): Promise<RetailerPrice[]> {
    return this.fetch(`/products/${id}/prices`);
  }

  async getProductFilterProperties(params: {
    category?: string;
    search?: string;
    filters?: Record<string, string>;
  }): Promise<ProductFilterPropertiesResponse> {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set("category", params.category);
    if (params.search) searchParams.set("search", params.search);
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        searchParams.set(`filters[${key}]`, value);
      }
    }
    return this.fetch(`/products/filter-properties?${searchParams}`);
  }

  // ---- Trends ----

  async getTrends(): Promise<Trend[]> {
    const data = await this.fetch<RawTrend[]>("/trends");
    return data.map((t) => ({
      id: t.id,
      name: t.name,
      image: t.image ?? "",
      stampScore: t.stamp_score,
      description: t.description ?? "",
      direction: t.direction ?? "stable",
      products: [], // Products are fetched separately for a trend
      videos: t.videos || [],
      articles: t.articles || [],
    }));
  }

  async getTrend(id: string): Promise<Trend> {
    const data = await this.fetch<RawTrend>(`/trends/${id}`);
    return {
      id: data.id,
      name: data.name,
      image: data.image,
      stampScore: data.stamp_score,
      description: data.description,
      direction: data.direction,
      products: (data.products || []).map(mapProduct),
      videos: data.videos,
      articles: data.articles,
    };
  }

  // ---- Quiz ----

  async getQuizQuestions(): Promise<RawQuizQuestion[]> {
    return this.fetch("/quiz/questions");
  }

  // ---- User Profile ----

  async getProfile(): Promise<BeautyProfile> {
    const data = await this.fetch<RawBeautyProfile>("/users/me/profile");
    return {
      skinTone: data.skin_tone || "",
      undertone: data.undertone || "",
      skinType: data.skin_type || "",
      coverage: data.coverage || "",
      finish: data.finish || "",
      budget: data.budget || "",
    };
  }

  async saveProfile(profile: BeautyProfile): Promise<void> {
    await this.fetch("/users/me/profile", {
      method: "PUT",
      body: JSON.stringify({
        skin_tone: profile.skinTone,
        undertone: profile.undertone,
        skin_type: profile.skinType,
        coverage: profile.coverage,
        finish: profile.finish,
        budget: profile.budget,
      }),
    });
  }

  // ---- Price History ----

  async getPriceHistory(productId: string): Promise<{ date: string; price: number; retailer: string }[]> {
    return this.fetch(`/products/${productId}/price-history`);
  }

  // ---- Styles & Notifications ----

  async getStyles(): Promise<string[]> {
    const data = await this.fetch<RawUserStyles>("/users/me/styles");
    return data.styles || [];
  }

  async saveStyles(styles: string[]): Promise<void> {
    await this.fetch("/users/me/styles", {
      method: "PUT",
      body: JSON.stringify({ styles }),
    });
  }

  async getNotifications(): Promise<boolean> {
    const data = await this.fetch<RawUserNotifications>("/users/me/notifications");
    return data.enabled ?? false;
  }

  async saveNotifications(enabled: boolean): Promise<void> {
    await this.fetch("/users/me/notifications", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }

  // ---- Builds ----

  async getActiveBuild(): Promise<RawBuild> {
    return this.fetch("/builds/active");
  }

  async createBuild(name?: string): Promise<RawBuild> {
    return this.fetch("/builds", {
      method: "POST",
      body: JSON.stringify({ name: name || "My Build" }),
    });
  }

  async setSlot(buildId: string, categoryKey: CategoryKey, productId: string): Promise<RawBuild> {
    return this.fetch(`/builds/${buildId}/slots/${categoryKey}`, {
      method: "PUT",
      body: JSON.stringify({ product_id: productId }),
    });
  }

  async clearSlot(buildId: string, categoryKey: string): Promise<void> {
    await this.fetch(`/builds/${buildId}/slots/${categoryKey}`, {
      method: "DELETE",
    });
  }
}

/** Map snake_case API response to camelCase Product type */
function mapProduct(data: RawProduct): Product {
  const normalizedPrices = Array.isArray(data.prices)
    ? data.prices.map((p: RawRetailerPrice) => ({
        retailer: p?.retailer || "Retailer",
        retailerLogo: p?.retailer_logo ?? undefined,
        price: Number.isFinite(Number(p?.price)) ? Number(p.price) : 0,
        url: p?.url || "#",
        inStock: Boolean(p?.in_stock ?? true), // Assuming in_stock or true by default
      }))
    : [];

  return {
    id: data.id,
    name: (data.name || "Product").toString().trim(),
    brand: (data.brand || "Unknown").toString().trim(),
    image: data.image || "/placeholder-product.jpg",
    category: data.category,
    stampScore: data.stamp_score,
    prices: normalizedPrices,
    description: data.description,
    specs: data.specs,
    reviews: data.reviews,
    walmartUrl: data.walmart_url,
    filters: data.filters || {},
  };
}

export const api = new ApiClient();
