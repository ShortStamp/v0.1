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
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-4 py-3 text-left font-medium">Retailer</th>
            <th className="px-4 py-3 text-left font-medium">Price</th>
            <th className="px-4 py-3 text-center font-medium">In Stock</th>
            <th className="px-4 py-3 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.retailer} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{item.retailer}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    hasKnownPrice(item) && item.price === lowestKnownPrice ? "font-bold text-green-600" : ""
                  }
                >
                  {hasKnownPrice(item) ? `$${item.price.toFixed(2)}` : "See retailer"}
                </span>
                {hasKnownPrice(item) && item.price === lowestKnownPrice && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Best
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {item.inStock ? (
                  <Check className="mx-auto h-4 w-4 text-green-600" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-red-400" />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {item.url && item.url !== "#" ? (
                  <a
                    href={item.url}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-all hover:shadow-md hover:shadow-accent/20 hover:brightness-110"
                  >
                    Buy <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-foreground/40">No link</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
