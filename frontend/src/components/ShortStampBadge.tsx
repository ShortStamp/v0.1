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
      ? "bg-pink-50 text-pink-700 ring-1 ring-pink-200"
      : score >= 80
        ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
        : score >= 70
          ? "bg-fuchsia-50 text-fuchsia-600 ring-1 ring-fuchsia-200"
          : "bg-pink-100 text-pink-800 ring-1 ring-pink-300";

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
