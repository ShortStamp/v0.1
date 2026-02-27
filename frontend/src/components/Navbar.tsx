"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const baseLinks = [
  { href: "/", label: "HOME" },
  { href: "/build", label: "BUILD" },
  { href: "/trends", label: "TRENDS" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  const navLinks = [
    ...baseLinks,
    isAuthenticated
      ? { href: "/profile", label: "PROFILE" }
      : { href: "/build/quiz", label: "LOG IN" },
  ];

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-serif font-bold italic">
            S
          </div>
          <span className="text-foreground text-sm font-bold uppercase tracking-[0.3em] font-sans group-hover:text-accent transition-colors">
            SHORTSTAMP
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:text-accent font-sans relative group ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60"
              }`}
            >
              {link.label}
              <span className={`absolute -bottom-1 left-0 h-[2px] bg-accent transition-all duration-300 ${
                pathname === link.href ? "w-full" : "w-0 group-hover:w-full"
              }`} />
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
            >
              LOG OUT
            </button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="rounded-full p-2 transition-colors hover:bg-muted md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5 text-accent" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="absolute top-full left-0 w-full rounded-b-2xl border-b border-border bg-background/95 backdrop-blur-lg px-6 py-8 md:hidden flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`text-sm font-bold uppercase tracking-[0.2em] transition-colors font-sans ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans text-left"
            >
              LOG OUT
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
