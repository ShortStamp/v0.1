import Link from "next/link";
import { Trend } from "@/types";
import ShortStampBadge from "./ShortStampBadge";
import { Flame } from "lucide-react";

interface TrendCardProps {
  trend: Trend;
}

export default function TrendCard({ trend }: TrendCardProps) {
  return (
    <Link href={`/trends/${trend.id}`}>
      <div className="group overflow-hidden border border-border bg-background transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
        <div className="flex h-48 items-center justify-center bg-muted">
          <Flame className="h-12 w-12 text-foreground/20" />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{trend.name}</h3>
            <ShortStampBadge
              score={trend.stampScore}
              direction={trend.direction}
              size="sm"
            />
          </div>
          <p className="line-clamp-2 text-sm text-foreground/60">{trend.description}</p>
          <p className="text-xs text-foreground/40">
            {trend.products.length} product{trend.products.length !== 1 && "s"}
          </p>
        </div>
      </div>
    </Link>
  );
}
