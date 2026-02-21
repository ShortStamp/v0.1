import { RetailerPrice } from "@/types";
import { ExternalLink, Check, X } from "lucide-react";
import { hasKnownPrice } from "@/lib/pricing";

interface PriceComparisonTableProps {
  prices: RetailerPrice[];
}

export default function PriceComparisonTable({ prices }: PriceComparisonTableProps) {
  const sorted = [...prices].sort((a, b) => {
    const aKey = hasKnownPrice(a) ? a.price : Number.POSITIVE_INFINITY;
    const bKey = hasKnownPrice(b) ? b.price : Number.POSITIVE_INFINITY;
    return aKey - bKey;
  });
  const lowestKnownPrice = sorted.find(hasKnownPrice)?.price;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Retailer</th>
            <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Current Price</th>
            <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Availability</th>
            <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.retailer} className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/10">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  {item.retailerLogo ? (
                    <img
                      // eslint-disable-next-line @next/next/no-img-element
                      src={item.retailerLogo}
                      alt={item.retailer}
                      className="h-6 w-auto max-w-[80px] object-contain opacity-70 group-hover:opacity-100"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : null}
                  <span className="font-semibold font-serif text-foreground/80">{item.retailer}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-sans font-bold tracking-tight ${
                      hasKnownPrice(item) && item.price === lowestKnownPrice ? "text-accent text-lg" : "text-foreground/70"
                    }`}
                  >
                    {hasKnownPrice(item) ? `$${item.price.toFixed(2)}` : "TBD"}
                  </span>
                  {hasKnownPrice(item) && item.price === lowestKnownPrice && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent font-sans">
                      Best Value
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                {item.inStock ? (
                  <div className="flex items-center justify-center gap-1.5 text-green-600">
                     <Check className="h-4 w-4" />
                     <span className="text-[10px] font-bold uppercase tracking-widest font-sans">In Stock</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-foreground/20">
                    <X className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-sans">Out of Stock</span>
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                {item.url && item.url !== "#" ? (
                  <a
                    href={item.url}
                    className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-background transition-all duration-300 hover:bg-accent hover:text-white font-sans"
                  >
                    Shop <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/20 font-sans">Sold Out</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
