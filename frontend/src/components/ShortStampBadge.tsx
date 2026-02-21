import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ShortStampBadgeProps {
  score: number;
  direction?: "rising" | "stable" | "declining";
  size?: "sm" | "md";
}

export default function ShortStampBadge({
  score,
  direction,
  size = "md",
}: ShortStampBadgeProps) {
  const grade =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D";

  const color =
    score >= 90
      ? "bg-accent text-white shadow-sm shadow-accent/20"
      : score >= 80
        ? "bg-pink-deep text-white shadow-sm shadow-pink-deep/20"
        : score >= 70
          ? "bg-secondary text-white shadow-sm shadow-secondary/20"
          : "bg-muted text-foreground/60 ring-1 ring-border";

  const Icon =
    direction === "rising"
      ? TrendingUp
      : direction === "declining"
        ? TrendingDown
        : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold font-sans rounded-full transition-all ${color} ${
        size === "sm" ? "px-2.5 py-1 text-[10px] tracking-wider" : "px-4 py-1.5 text-xs tracking-widest"
      }`}
    >
      {grade} · {score}
      {direction && <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />}
    </span>
  );
}
