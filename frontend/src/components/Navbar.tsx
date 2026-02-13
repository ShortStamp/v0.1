"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "HOME" },
  { href: "/build", label: "BUILD" },
  { href: "/trends", label: "TRENDS" },
  { href: "/profile", label: "PROFILE" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-base font-bold uppercase tracking-[0.2em] text-transparent"
        >
          SHORTSTAMP
        </Link>

        {/* Desktop nav */}
        <div className="hidden gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:text-accent ${
                pathname === link.href
                  ? "text-accent underline underline-offset-4 decoration-accent-light"
                  : "text-foreground/50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          className="rounded-xl p-2 transition-colors hover:bg-muted md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-border bg-white/95 backdrop-blur-md px-6 pb-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-3 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:text-accent ${
                pathname === link.href
                  ? "text-accent underline underline-offset-4 decoration-accent-light"
                  : "text-foreground/50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
