"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, type AdminBrand } from "@/lib/adminApi";

const CATEGORIES = [
  "foundation", "concealer", "primer", "powder", "setting-spray",
  "eyeshadow", "eyeliner", "mascara", "false-lashes",
  "brow-pencil", "brow-gel",
  "contour", "bronzer", "blush", "highlighter",
  "lip-liner", "lipstick", "lip-gloss",
];

export default function AdminProductNewPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState("/placeholder-product.jpg");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState("");
  const [ingredients, setIngredients] = useState("");

  useEffect(() => {
    adminApi.getBrands().then(setBrands).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const product = await adminApi.createProduct({
        name,
        brand,
        category_key: categoryKey,
        image_url: imageUrl,
        description: description || null,
        specs: specs ? specs.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        inci_ingredients: ingredients
          ? ingredients.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      });
      router.push(`/admin/products/${product.id}`);
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xs font-bold tracking-[0.15em] uppercase">New Product</h1>
        <button
          onClick={() => router.back()}
          className="text-xs tracking-[0.15em] uppercase border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors duration-200"
        >
          ← Back
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 tracking-wide mb-4">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
          />
        </Field>

        <Field label="Brand">
          <input
            required
            list="brands-list"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
          />
          <datalist id="brands-list">
            {brands.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Category">
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            required
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Image URL">
          <div className="flex gap-3 items-center">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl || "/placeholder-product.jpg"}
              alt="preview"
              className="w-14 h-14 object-cover border border-gray-200"
            />
          </div>
        </Field>

        <Field label="Description">
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black resize-y"
          />
        </Field>

        <Field label="Specs (one per line)">
          <textarea
            rows={4}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black resize-y font-mono"
            placeholder="Long-wearing&#10;SPF 30&#10;Cruelty-free"
          />
        </Field>

        <Field label="Ingredients (comma-separated)">
          <textarea
            rows={6}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black resize-y font-mono"
            placeholder="Aqua, Glycerin, Niacinamide, …"
          />
        </Field>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-black text-white text-xs tracking-[0.15em] uppercase px-6 py-2 hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-[0.15em] uppercase font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
