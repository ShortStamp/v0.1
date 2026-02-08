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
      ? "bg-green-100 text-green-800"
      : score >= 80
        ? "bg-emerald-100 text-emerald-800"
        : score >= 70
          ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-800";

  const Icon =
    direction === "rising"
      ? TrendingUp
      : direction === "declining"
        ? TrendingDown
        : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${color} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {grade} · {score}
      {direction && <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />}
    </span>
  );
}
