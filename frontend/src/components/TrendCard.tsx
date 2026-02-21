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
      <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background transition-all duration-300 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1">
        <div className="relative flex h-56 items-center justify-center bg-gradient-to-br from-muted to-pink-soft/20 transition-colors group-hover:from-pink-soft/30 group-hover:to-muted">
          {trend.image ? (
             <img
             // eslint-disable-next-line @next/next/no-img-element
             src={trend.image}
             alt={trend.name}
             className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
           />
          ) : (
            <Flame className="h-16 w-16 text-accent/20 transition-transform duration-500 group-hover:scale-110 group-hover:text-accent/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold font-serif leading-tight">{trend.name}</h3>
            <ShortStampBadge
              score={trend.stampScore}
              direction={trend.direction}
              size="sm"
            />
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-foreground/60 font-sans">
            {trend.description}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 font-sans">
              {trend.products.length} CURATED PRODUCT{trend.products.length !== 1 && "S"}
            </p>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent opacity-0 transition-all duration-300 group-hover:opacity-100 font-sans">
              Explore →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
