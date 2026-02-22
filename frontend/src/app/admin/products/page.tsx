"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminProductListItem, type PaginatedAdminProducts } from "@/lib/adminApi";

const CATEGORIES = [
  "foundation", "concealer", "primer", "powder", "setting-spray",
  "eyeshadow", "eyeliner", "mascara", "false-lashes",
  "brow-pencil", "brow-gel",
  "contour", "bronzer", "blush", "highlighter",
  "lip-liner", "lipstick", "lip-gloss",
];

export default function AdminProductsPage() {
  const [data, setData] = useState<PaginatedAdminProducts | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi
      .getProducts({
        search: search || undefined,
        category: category || undefined,
        is_active: isActiveFilter === "" ? undefined : isActiveFilter === "true",
        page,
        per_page: 50,
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  // Reload when filters change (reset page on filter change)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this product?")) return;
    await adminApi.deleteProduct(id).catch(alert);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xs font-bold tracking-[0.15em] uppercase">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-black text-white text-xs tracking-[0.15em] uppercase px-4 py-2 hover:bg-gray-800 transition-colors duration-200"
        >
          + New Product
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-black px-3 py-2 text-xs tracking-wide flex-1 min-w-[200px] outline-none focus:ring-1 focus:ring-black"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={isActiveFilter}
          onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1); }}
          className="border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button
          type="submit"
          className="bg-black text-white text-xs tracking-[0.15em] uppercase px-4 py-2 hover:bg-gray-800 transition-colors duration-200"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 tracking-wide mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-xs tracking-[0.15em] uppercase text-gray-400 mb-4">Loading…</p>
      )}

      {data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black">
                  {["ID", "Name", "Brand", "Category", "Score", "Active", "Source", "Actions"].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 tracking-[0.12em] uppercase font-bold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <ProductRow key={p.id} product={p} onDeactivate={handleDeactivate} />
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 tracking-wide">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs tracking-[0.15em] uppercase px-4 py-2 border border-black disabled:opacity-30 hover:bg-black hover:text-white transition-colors duration-200 disabled:pointer-events-none"
            >
              ← Prev
            </button>
            <span className="text-xs tracking-wide">
              Page {data.page} of {data.pages} &nbsp;·&nbsp; {data.total.toLocaleString()} total
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs tracking-[0.15em] uppercase px-4 py-2 border border-black disabled:opacity-30 hover:bg-black hover:text-white transition-colors duration-200 disabled:pointer-events-none"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProductRow({
  product,
  onDeactivate,
}: {
  product: AdminProductListItem;
  onDeactivate: (id: string) => void;
}) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200">
      <td className="py-2 pr-4 font-mono text-gray-500">{product.id.slice(0, 8)}</td>
      <td className="py-2 pr-4 max-w-[200px] truncate">{product.name}</td>
      <td className="py-2 pr-4 max-w-[120px] truncate">{product.brand}</td>
      <td className="py-2 pr-4">{product.category}</td>
      <td className="py-2 pr-4 font-mono">{product.stamp_score}</td>
      <td className="py-2 pr-4">
        <span
          className={`inline-block text-xs px-2 py-0.5 tracking-wide ${
            product.is_active ? "bg-black text-white" : "border border-gray-400 text-gray-400"
          }`}
        >
          {product.is_active ? "Active" : "Off"}
        </span>
      </td>
      <td className="py-2 pr-4 text-gray-500">{product.source}</td>
      <td className="py-2 flex gap-2">
        <Link
          href={`/admin/products/${product.id}`}
          className="text-xs tracking-[0.12em] uppercase border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors duration-200"
        >
          Edit
        </Link>
        {product.is_active && (
          <button
            onClick={() => onDeactivate(product.id)}
            className="text-xs tracking-[0.12em] uppercase border border-gray-400 text-gray-500 px-2 py-1 hover:border-black hover:text-black transition-colors duration-200"
          >
            Deactivate
          </button>
        )}
      </td>
    </tr>
  );
}
