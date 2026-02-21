"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  const pathname = usePathname();

  const isAdmin = isAuthenticated && user?.is_admin;

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
      >
        <p className="text-xs tracking-[0.15em] uppercase text-black">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLoginScreen login={login} notAdmin={isAuthenticated && !user?.is_admin} />;
  }

  const navLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/products", label: "Products" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
    >
      {/* Header */}
      <header className="flex h-12 items-center justify-between bg-black px-6 flex-shrink-0">
        <span className="text-xs font-bold tracking-[0.15em] uppercase text-white">
          ShortStamp Admin
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 tracking-wide">{user.email}</span>
          <button
            onClick={() => logout()}
            className="text-xs tracking-[0.15em] uppercase text-white border border-white px-3 py-1 hover:bg-white hover:text-black transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-48 bg-black flex-shrink-0 pt-6">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-6 py-3 text-xs tracking-[0.15em] uppercase transition-colors duration-200 ${
                  isActive
                    ? "bg-white text-black font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-white p-8">{children}</main>
      </div>
    </div>
  );
}

function AdminLoginScreen({
  login,
  notAdmin,
}: {
  login: (email: string, password: string) => Promise<void>;
  notAdmin: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
    >
      <header className="flex h-12 items-center bg-black px-6 flex-shrink-0">
        <span className="text-xs font-bold tracking-[0.15em] uppercase text-white">
          ShortStamp Admin
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-80">
          <h1 className="text-xs font-bold tracking-[0.15em] uppercase mb-8">
            Administrator Login
          </h1>

          {notAdmin && (
            <p className="text-xs tracking-wide text-red-600 mb-4 border border-red-300 px-3 py-2">
              This account does not have admin access.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs tracking-[0.15em] uppercase font-bold mb-1">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs tracking-[0.15em] uppercase font-bold mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-black px-3 py-2 text-xs tracking-wide outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {error && (
              <p className="text-xs tracking-wide text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white text-xs tracking-[0.15em] uppercase py-2 hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
