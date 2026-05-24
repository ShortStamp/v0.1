"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Register account on backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await axios.post(`${apiUrl}/auth/register`, { email, password });

      // 2. Create Stripe checkout session
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Nav */}
      <nav className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-bold tracking-[0.15em] uppercase"
          >
            ShortStamp
          </Link>
          <span className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400">
            Subscribe
          </span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-3">
              Step 1 of 2
            </p>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              Create your account
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Enter your email and choose a password. You&apos;ll be taken to
              Stripe to complete your $60/month subscription.
            </p>
          </div>

          {/* Progress */}
          <div className="flex gap-2 mb-10">
            <div className="h-1 flex-1 bg-black" />
            <div className="h-1 flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-black px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-[0.15em] uppercase mb-2">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full border border-black px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-400"
              />
            </div>

            {error && (
              <div className="border border-black bg-gray-50 px-4 py-3">
                <p className="text-xs text-black">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white px-8 py-4 text-sm font-bold tracking-[0.15em] uppercase hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Continue to Payment →"}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-6 text-center leading-relaxed">
            By continuing, you agree to our terms of service.
            <br />
            Secure checkout via Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
