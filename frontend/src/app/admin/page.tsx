"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminStats } from "@/lib/adminApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase text-red-600">{error}</p>
    );
  }

  if (!stats) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase text-gray-400">Loading…</p>
    );
  }

  const sorted = Object.entries(stats.products_by_category).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div>
      <h1 className="text-xs font-bold tracking-[0.15em] uppercase mb-8">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Total Products" value={stats.total_products} />
        <StatCard label="Active Products" value={stats.active_products} />
        <StatCard label="Total Brands" value={stats.total_brands} />
      </div>

      {/* Category breakdown */}
      <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4">
        Products by Category
      </h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-2 text-xs tracking-[0.15em] uppercase font-bold">
              Category
            </th>
            <th className="text-right py-2 text-xs tracking-[0.15em] uppercase font-bold">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([cat, count]) => (
            <tr key={cat} className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200">
              <td className="py-2 text-xs tracking-wide">{cat}</td>
              <td className="py-2 text-right font-mono text-xs">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black p-6">
      <p className="text-xs tracking-[0.15em] uppercase text-gray-500 mb-2">{label}</p>
      <p className="font-mono text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
