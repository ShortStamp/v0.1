"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  adminApi,
  AnalyticsSummary,
  DailyCount,
  QuizDistribution,
  TopProductRow,
  TopAffiliateRow,
  CategoryHeatmapRow,
  CohortRow,
} from "@/lib/adminApi";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-black p-6 flex flex-col gap-3">
      <p className="text-[10px] tracking-[0.15em] uppercase font-bold text-gray-500">{label}</p>
      <p className="text-4xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] tracking-[0.15em] uppercase font-bold mb-4 border-b border-black pb-2">
      {children}
    </h2>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-black p-6">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [quizTrend, setQuizTrend] = useState<DailyCount[]>([]);
  const [quizDist, setQuizDist] = useState<QuizDistribution | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [topAffiliates, setTopAffiliates] = useState<TopAffiliateRow[]>([]);
  const [heatmap, setHeatmap] = useState<CategoryHeatmapRow[]>([]);
  const [cohort, setCohort] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, qt, qd, tp, ta, hm, co] = await Promise.all([
          adminApi.getAnalyticsSummary(),
          adminApi.getQuizTrend(30),
          adminApi.getQuizDistribution(),
          adminApi.getTopProductsAdded(10),
          adminApi.getTopAffiliateClicks(10),
          adminApi.getCategoryHeatmap(),
          adminApi.getCohortRetention(),
        ]);
        setSummary(s);
        setQuizTrend(qt);
        setQuizDist(qd);
        setTopProducts(tp);
        setTopAffiliates(ta);
        setHeatmap(hm);
        setCohort(co);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase">Loading analytics…</p>
    );
  }

  if (error) {
    return (
      <p className="text-xs tracking-[0.15em] uppercase text-red-600 border border-red-300 p-4">
        {error}
      </p>
    );
  }

  const trendData = quizTrend.map((d) => ({
    day: d.day.slice(5), // MM-DD
    count: d.count,
  }));

  return (
    <div className="space-y-10" style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}>
      <h1 className="text-xs font-bold tracking-[0.15em] uppercase">Analytics</h1>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Quiz Completions" value={summary?.quiz_completions ?? 0} />
        <StatCard label="Unique Sessions (30d)" value={summary?.unique_sessions ?? 0} />
        <StatCard label="Affiliate Clicks" value={summary?.affiliate_clicks ?? 0} />
        <StatCard label="Active Users (30d)" value={summary?.active_users_30d ?? 0} />
      </div>

      {/* ── Quiz trend ── */}
      <div>
        <SectionTitle>Quiz Completions — Last 30 Days</SectionTitle>
        <ChartShell>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }}
                cursor={{ stroke: "#000", strokeWidth: 1 }}
              />
              <Line type="monotone" dataKey="count" stroke="#000000" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* ── Quiz distributions ── */}
      {quizDist && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <SectionTitle>Skin Tone Distribution</SectionTitle>
            <ChartShell>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={quizDist.skin_tone.map((d) => ({ label: d.label, count: d.count }))}
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#000000" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>

          <div>
            <SectionTitle>Finish Distribution</SectionTitle>
            <ChartShell>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={quizDist.finish.map((d) => ({ label: d.label, count: d.count }))}
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#000000" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>
        </div>
      )}

      {quizDist && (
        <div>
          <SectionTitle>Coverage Distribution</SectionTitle>
          <ChartShell>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                layout="vertical"
                data={quizDist.coverage.map((d) => ({ label: d.label, count: d.count }))}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
                <Bar dataKey="count" fill="#000000" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      )}

      {/* ── Top products + top affiliate ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Top 10 Products Added to Build</SectionTitle>
          <ChartShell>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={topProducts.map((r) => ({
                  label: r.product_name ?? "Unknown",
                  count: r.count,
                }))}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + "…" : v)}
                />
                <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
                <Bar dataKey="count" fill="#000000" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>

        <div>
          <SectionTitle>Top 10 Affiliate Clicks</SectionTitle>
          <ChartShell>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={topAffiliates.map((r) => ({
                  label: `${r.product_id ?? "?"} / ${r.retailer ?? "?"}`,
                  count: r.count,
                }))}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + "…" : v)}
                />
                <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
                <Bar dataKey="count" fill="#000000" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      </div>

      {/* ── Category heatmap ── */}
      <div>
        <SectionTitle>Category Heatmap — Products Added</SectionTitle>
        <ChartShell>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              layout="vertical"
              data={heatmap.map((r) => ({ label: r.category ?? "Unknown", count: r.count }))}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip contentStyle={{ border: "1px solid #000", borderRadius: 0, fontSize: 11 }} />
              <Bar dataKey="count" fill="#000000" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* ── Retention cohort table ── */}
      <div>
        <SectionTitle>Retention Cohort</SectionTitle>
        {cohort.length === 0 ? (
          <p className="text-xs tracking-wide text-gray-400 border border-gray-200 p-4">
            No cohort data yet. Cohorts appear once app_opened events are recorded.
          </p>
        ) : (
          <div className="border border-black overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-4 py-3 text-left tracking-[0.15em] uppercase font-bold">Cohort Week</th>
                  <th className="px-4 py-3 text-right tracking-[0.15em] uppercase font-bold">W0</th>
                  <th className="px-4 py-3 text-right tracking-[0.15em] uppercase font-bold">W1</th>
                  <th className="px-4 py-3 text-right tracking-[0.15em] uppercase font-bold">W2</th>
                  <th className="px-4 py-3 text-right tracking-[0.15em] uppercase font-bold">W4</th>
                </tr>
              </thead>
              <tbody>
                {cohort.map((row, i) => (
                  <tr
                    key={row.cohort_week}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2 font-mono tracking-wide">{row.cohort_week}</td>
                    <CohortCell value={row.w0} />
                    <CohortCell value={row.w1} />
                    <CohortCell value={row.w2} />
                    <CohortCell value={row.w4} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CohortCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-4 py-2 text-right text-gray-300">—</td>;
  }
  const shade = value >= 50 ? "bg-black text-white" : value >= 25 ? "bg-gray-700 text-white" : value >= 10 ? "bg-gray-400 text-white" : "bg-gray-100 text-gray-700";
  return (
    <td className="px-4 py-2 text-right">
      <span className={`inline-block px-2 py-0.5 font-mono text-[10px] font-bold ${shade}`}>
        {value}%
      </span>
    </td>
  );
}
