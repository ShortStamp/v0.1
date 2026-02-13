import type {
  BeautyProfile,
  CategoryGroup,
  CategoryDefinition,
  Product,
  RetailerPrice,
  Trend,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface AuthResponse {
  user: { id: string; email: string; display_name: string | null };
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
      throw new Error(body.detail || `API error: ${res.status}`);
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
    const groups = await this.fetch<
      { key: string; label: string; categories: { key: string; label: string; group_key: string; filters: any[] }[] }[]
    >("/categories/groups");
    return groups.map((g) => ({
      key: g.key,
      label: g.label,
      categories: g.categories.map((c) => c.key) as any,
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

    const data = await this.fetch<any>(`/products?${searchParams}`);
    return {
      ...data,
      items: data.items.map(mapProduct),
    };
  }

  async getProduct(id: string): Promise<Product> {
    const data = await this.fetch<any>(`/products/${id}`);
    return mapProduct(data);
  }

  async getProductPrices(id: string): Promise<RetailerPrice[]> {
    return this.fetch(`/products/${id}/prices`);
  }

  // ---- Trends ----

  async getTrends(): Promise<Trend[]> {
    const data = await this.fetch<any[]>("/trends");
    return data.map((t) => ({
      id: t.id,
      name: t.name,
      image: t.image,
      stampScore: t.stamp_score,
      description: t.description,
      direction: t.direction,
      products: [],
    }));
  }

  async getTrend(id: string): Promise<Trend> {
    const data = await this.fetch<any>(`/trends/${id}`);
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

  async getQuizQuestions(): Promise<any[]> {
    return this.fetch("/quiz/questions");
  }

  // ---- User Profile ----

  async getProfile(): Promise<BeautyProfile> {
    const data = await this.fetch<any>("/users/me/profile");
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

  // ---- Builds ----

  async getActiveBuild(): Promise<any> {
    return this.fetch("/builds/active");
  }

  async createBuild(name?: string): Promise<any> {
    return this.fetch("/builds", {
      method: "POST",
      body: JSON.stringify({ name: name || "My Build" }),
    });
  }

  async setSlot(buildId: string, categoryKey: string, productId: string): Promise<any> {
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
function mapProduct(data: any): Product {
  return {
    id: data.id,
    name: data.name,
    brand: data.brand,
    image: data.image,
    category: data.category,
    stampScore: data.stamp_score,
    prices: data.prices || [],
    description: data.description,
    specs: data.specs,
    reviews: data.reviews,
    filters: data.filters || {},
  };
}

export const api = new ApiClient();
