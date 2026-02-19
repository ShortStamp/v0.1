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
      ? "bg-foreground text-background"
      : score >= 80
        ? "bg-foreground/80 text-background"
        : score >= 70
          ? "bg-foreground/60 text-background"
          : "bg-muted text-foreground ring-1 ring-border";

  const Icon =
    direction === "rising"
      ? TrendingUp
      : direction === "declining"
        ? TrendingDown
        : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${color} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {grade} · {score}
      {direction && <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />}
    </span>
  );
}
