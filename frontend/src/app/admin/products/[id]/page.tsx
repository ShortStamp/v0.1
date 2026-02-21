"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, type AdminBrand, type AdminPriceRow, type AdminProductDetail } from "@/lib/adminApi";

const CATEGORIES = [
  "foundation", "concealer", "primer", "powder", "setting-spray",
  "eyeshadow", "eyeliner", "mascara", "false-lashes",
  "brow-pencil", "brow-gel",
  "contour", "bronzer", "blush", "highlighter",
  "lip-liner", "lipstick", "lip-gloss",
];

export default function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getProduct(id), adminApi.getBrands()])
      .then(([p, b]) => {
        setProduct(p);
        setBrands(b);
        setName(p.name);
        setBrand(p.brand);
        setCategoryKey(p.category);
        setImageUrl(p.image_url);
        setDescription(p.description || "");
        setSpecs((p.specs || []).join("\n"));
        setIngredients((p.inci_ingredients || []).join(", "));
        setIsActive(p.is_active);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await adminApi.updateProduct(id, {
        name,
        brand,
        category_key: categoryKey,
        image_url: imageUrl,
        description: description || null,
        specs: specs ? specs.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        inci_ingredients: ingredients
          ? ingredients.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        is_active: isActive,
      });
      setProduct(updated);
      setSaveSuccess(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Deactivate this product?")) return;
    await adminApi.deleteProduct(id).catch((e) => setError(String(e)));
    router.push("/admin/products");
  };

  if (error && !product) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase text-red-600">{error}</p>
    );
  }

  if (!product) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase text-gray-400">Loading…</p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xs font-bold tracking-[0.15em] uppercase">Edit Product</h1>
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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left — Edit form */}
        <form onSubmit={handleSave} className="flex-1 space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
            />
          </Field>

          <Field label="Brand">
            <input
              list="brands-list"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
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

          <Field label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs tracking-wide">Product is active</span>
            </label>
          </Field>

          {saveSuccess && (
            <p className="text-xs tracking-wide text-green-700">Saved successfully.</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white text-xs tracking-[0.15em] uppercase px-6 py-2 hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {product.is_active && (
              <button
                type="button"
                onClick={handleDeactivate}
                className="border border-gray-400 text-gray-500 text-xs tracking-[0.15em] uppercase px-4 py-2 hover:border-black hover:text-black transition-colors duration-200"
              >
                Deactivate
              </button>
            )}
          </div>
        </form>

        {/* Right — Price links */}
        <div className="lg:w-96 flex-shrink-0">
          <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4">Price Links</h2>
          <PriceLinksPanel productId={id} initialPrices={product.prices} />
        </div>
      </div>
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

function PriceLinksPanel({
  productId,
  initialPrices,
}: {
  productId: string;
  initialPrices: AdminPriceRow[];
}) {
  const [prices, setPrices] = useState<AdminPriceRow[]>(initialPrices);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminPriceRow>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newRetailer, setNewRetailer] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newInStock, setNewInStock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (p: AdminPriceRow) => {
    setEditingId(p.id);
    setEditForm({ retailer: p.retailer || "", url: p.url, price: p.price, in_stock: p.in_stock });
  };

  const saveEdit = async (priceId: number) => {
    try {
      const updated = await adminApi.updatePrice(productId, priceId, {
        retailer: editForm.retailer || undefined,
        url: editForm.url,
        price: editForm.price,
        in_stock: editForm.in_stock,
      });
      setPrices((prev) => prev.map((p) => (p.id === priceId ? updated : p)));
      setEditingId(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const deletePrice = async (priceId: number) => {
    if (!confirm("Delete this price link?")) return;
    try {
      await adminApi.deletePrice(productId, priceId);
      setPrices((prev) => prev.filter((p) => p.id !== priceId));
    } catch (e) {
      setError(String(e));
    }
  };

  const addPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await adminApi.addPrice(productId, {
        retailer: newRetailer,
        url: newUrl,
        price: parseFloat(newPrice),
        in_stock: newInStock,
      });
      setPrices((prev) => [...prev, created]);
      setNewRetailer("");
      setNewUrl("");
      setNewPrice("");
      setNewInStock(true);
      setShowAdd(false);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <table className="w-full border-collapse text-xs mb-4">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 pr-2 tracking-[0.12em] uppercase font-bold">Retailer</th>
            <th className="text-left py-1 pr-2 tracking-[0.12em] uppercase font-bold">Price</th>
            <th className="text-left py-1 pr-2 tracking-[0.12em] uppercase font-bold">In Stock</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {prices.map((p) =>
            editingId === p.id ? (
              <tr key={p.id} className="border-b border-gray-200">
                <td className="py-1 pr-2">
                  <input
                    value={editForm.retailer || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, retailer: e.target.value }))}
                    className="w-full border border-black px-1 py-0.5 text-xs outline-none"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, price: parseFloat(e.target.value) }))}
                    className="w-20 border border-black px-1 py-0.5 text-xs font-mono outline-none"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="checkbox"
                    checked={editForm.in_stock ?? true}
                    onChange={(e) => setEditForm((f) => ({ ...f, in_stock: e.target.checked }))}
                  />
                </td>
                <td className="py-1 flex gap-1">
                  <button
                    onClick={() => saveEdit(p.id)}
                    className="text-xs tracking-wide bg-black text-white px-2 py-0.5 hover:bg-gray-800 transition-colors duration-200"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs tracking-wide border border-gray-400 text-gray-500 px-2 py-0.5"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200">
                <td className="py-1 pr-2 max-w-[100px] truncate">{p.retailer || p.source || "—"}</td>
                <td className="py-1 pr-2 font-mono">${p.price.toFixed(2)}</td>
                <td className="py-1 pr-2">{p.in_stock ? "Yes" : "No"}</td>
                <td className="py-1 flex gap-1">
                  <button
                    onClick={() => startEdit(p)}
                    className="text-xs tracking-wide border border-black px-2 py-0.5 hover:bg-black hover:text-white transition-colors duration-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePrice(p.id)}
                    className="text-xs tracking-wide border border-gray-300 text-gray-400 px-2 py-0.5 hover:border-red-500 hover:text-red-500 transition-colors duration-200"
                  >
                    Del
                  </button>
                </td>
              </tr>
            )
          )}
          {prices.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-400">
                No price links yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add new price */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs tracking-[0.15em] uppercase border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors duration-200"
        >
          + Add Link
        </button>
      ) : (
        <form onSubmit={addPrice} className="border border-black p-4 space-y-3">
          <p className="text-xs font-bold tracking-[0.15em] uppercase">Add Price Link</p>
          <input
            required
            placeholder="Retailer name"
            value={newRetailer}
            onChange={(e) => setNewRetailer(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black"
          />
          <input
            required
            placeholder="URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0"
            placeholder="Price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-black"
          />
          <label className="flex items-center gap-2 text-xs tracking-wide cursor-pointer">
            <input
              type="checkbox"
              checked={newInStock}
              onChange={(e) => setNewInStock(e.target.checked)}
              className="w-4 h-4"
            />
            In Stock
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-black text-white text-xs tracking-[0.15em] uppercase px-4 py-1.5 hover:bg-gray-800 transition-colors duration-200"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="border border-gray-400 text-gray-500 text-xs tracking-[0.15em] uppercase px-4 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
