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
  const { user, isAuthenticated, logout } = useAuth();

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
<<<<<<< Updated upstream
          className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-base font-bold uppercase tracking-[0.2em] text-transparent"
=======
          className="group flex items-center gap-2"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
              className={`text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:text-accent ${
                pathname === link.href
                  ? "text-accent underline underline-offset-4 decoration-accent-light"
                  : "text-foreground/50"
=======
              className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:text-accent font-sans relative group ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
              className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-accent"
=======
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
>>>>>>> Stashed changes
            >
              LOG OUT
            </button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
<<<<<<< Updated upstream
          className="rounded-xl p-2 transition-colors hover:bg-muted md:hidden"
=======
          className="rounded-full p-2 transition-colors hover:bg-muted md:hidden"
>>>>>>> Stashed changes
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5 text-accent" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="absolute top-full left-0 w-full border-b border-border bg-background/95 backdrop-blur-lg px-6 py-8 md:hidden flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
<<<<<<< Updated upstream
              className={`block py-3 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:text-accent ${
                pathname === link.href
                  ? "text-accent underline underline-offset-4 decoration-accent-light"
                  : "text-foreground/50"
=======
              className={`text-sm font-bold uppercase tracking-[0.2em] transition-colors font-sans ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60"
>>>>>>> Stashed changes
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
<<<<<<< Updated upstream
              className="block w-full py-3 text-left text-xs font-medium uppercase tracking-[0.15em] text-foreground/50 transition-colors hover:text-accent"
=======
              className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans text-left"
>>>>>>> Stashed changes
            >
              LOG OUT
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
