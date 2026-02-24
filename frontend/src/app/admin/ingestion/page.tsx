"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type IngestionStats, type JobStatusResponse } from "@/lib/adminApi";

export default function IngestionPage() {
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [limit, setLimit] = useState(200);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(() => {
    adminApi
      .getIngestionStats()
      .then((s) => { setStats(s); setStatsError(null); })
      .catch((e) => setStatsError(e instanceof Error ? e.message : String(e)));
  }, []);

  const loadStatus = useCallback(() => {
    adminApi.getAgentStatus().then(setStatus).catch(() => null);
  }, []);

  // Initial load
  useEffect(() => {
    loadStats();
    loadStatus();
  }, [loadStats, loadStatus]);

  // Poll while running
  useEffect(() => {
    if (status?.running) {
      pollRef.current = setInterval(() => {
        loadStatus();
      }, 2000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      // Refresh stats when a job finishes
      if (status?.finished_at) {
        loadStats();
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status?.running, status?.finished_at, loadStatus, loadStats]);

  const handleRun = async () => {
    setError(null);
    setStarting(true);
    try {
      const res = await adminApi.runIngredientAgent({ limit });
      if (res.status === "already_running") {
        setError(res.message ?? "A job is already running.");
      } else {
        // Start polling immediately
        await loadStatus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const filledCount = stats ? stats.total_active - stats.missing_ingredients : 0;
  const fillPct = stats && stats.total_active > 0
    ? Math.round((filledCount / stats.total_active) * 100)
    : 0;

  const jobProgress = status?.progress;
  const jobTotal = status?.total ?? 0;
  const jobQueried = jobProgress?.queried ?? 0;
  const progressPct = jobTotal > 0 ? Math.round((jobQueried / jobTotal) * 100) : 0;

  const lastError =
    status?.last_result && "error" in status.last_result
      ? String(status.last_result.error)
      : null;

  return (
    <div>
      <h1 className="text-xs font-bold tracking-[0.15em] uppercase mb-8">
        Ingredient Ingestion
      </h1>

      {statsError && (
        <p className="mb-6 text-xs tracking-wide text-red-600 border border-red-300 px-3 py-2">
          Could not load stats: {statsError}. Is the backend running?
        </p>
      )}

      {/* Coverage stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard
          label="Active Products"
          value={stats ? stats.total_active.toLocaleString() : "—"}
        />
        <StatCard
          label="With Ingredients"
          value={stats ? filledCount.toLocaleString() : "—"}
        />
        <StatCard
          label="Missing Ingredients"
          value={stats ? stats.missing_ingredients.toLocaleString() : "—"}
          highlight={!!stats && stats.missing_ingredients > 0}
        />
      </div>

      {/* Coverage bar */}
      {stats && (
        <div className="mb-10">
          <div className="flex justify-between mb-1">
            <span className="text-xs tracking-[0.15em] uppercase text-gray-500">
              Ingredient Coverage
            </span>
            <span className="font-mono text-xs font-bold">{fillPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 border border-gray-200">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Run controls */}
      <div className="border border-black p-6 mb-8">
        <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4">
          Batch Ingredient Lookup
        </h2>
        <p className="text-xs text-gray-500 tracking-wide mb-6 leading-relaxed">
          Uses Gemini with Google Search to find INCI ingredient lists for products
          that have none. Processes products in priority order: Sephora → Ulta → Amazon → Other.
        </p>

        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs tracking-[0.15em] uppercase font-bold mb-1">
              Product Limit
            </label>
            <input
              type="number"
              min={1}
              max={2000}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(2000, Number(e.target.value))))}
              disabled={status?.running}
              className="w-28 border border-black px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-black disabled:opacity-40"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={starting || status?.running || stats?.missing_ingredients === 0}
            className="bg-black text-white text-xs tracking-[0.15em] uppercase px-6 py-2 hover:bg-gray-800 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status?.running
              ? "Running…"
              : starting
              ? "Starting…"
              : stats?.missing_ingredients === 0
              ? "All Filled"
              : "Run Now"}
          </button>

          {status?.running && (
            <span className="text-xs tracking-wide text-gray-500 animate-pulse">
              Processing in background…
            </span>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs tracking-wide text-red-600">{error}</p>
        )}
      </div>

      {/* Job status */}
      {status && (status.running || status.started_at) && (
        <div className="border border-black p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase">
              {status.running ? "Job Running" : "Last Job"}
            </h2>
            {status.running && (
              <span className="text-xs tracking-[0.15em] uppercase text-gray-400 animate-pulse">
                Live
              </span>
            )}
          </div>

          {/* Progress bar */}
          {status.running && jobTotal > 0 && (
            <div className="mb-5">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500 tracking-wide">
                  {jobQueried} / {jobTotal} products queried
                </span>
                <span className="font-mono text-xs font-bold">{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 border border-gray-200">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            <MiniStat label="Queried" value={jobQueried} />
            <MiniStat label="Updated" value={jobProgress?.updated ?? 0} accent />
            <MiniStat label="Not Found" value={jobProgress?.not_found ?? 0} />
            <MiniStat label="Errors" value={jobProgress?.errors ?? 0} danger={!!jobProgress?.errors} />
          </div>

          {/* Timestamps */}
          <div className="mt-4 flex gap-6">
            {status.started_at && (
              <p className="text-xs text-gray-400 tracking-wide">
                Started: {new Date(status.started_at).toLocaleTimeString()}
              </p>
            )}
            {status.finished_at && !status.running && (
              <p className="text-xs text-gray-400 tracking-wide">
                Finished: {new Date(status.finished_at).toLocaleTimeString()}
              </p>
            )}
          </div>

          {lastError && (
            <p className="mt-3 text-xs tracking-wide text-red-600 border border-red-200 px-3 py-2">
              Error: {lastError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border p-6 ${highlight ? "border-black" : "border-black"}`}>
      <p className="text-xs tracking-[0.15em] uppercase text-gray-500 mb-2">{label}</p>
      <p className={`font-mono text-3xl font-bold ${highlight ? "text-black" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
  danger = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="border border-gray-200 p-4">
      <p className="text-xs tracking-[0.15em] uppercase text-gray-500 mb-1">{label}</p>
      <p
        className={`font-mono text-2xl font-bold ${
          danger && value > 0 ? "text-red-600" : accent && value > 0 ? "text-black" : "text-gray-700"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
