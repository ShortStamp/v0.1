import Link from "next/link";
import { Product } from "@/types";
import ShortStampBadge from "./ShortStampBadge";
import { ShoppingBag } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  selectable?: boolean;
}

export default function ProductCard({ product, onSelect, selectable }: ProductCardProps) {
  const lowestPrice = Math.min(...product.prices.map((p) => p.price));

  const content = (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition-all hover:shadow-lg hover:shadow-accent/10 hover:-translate-y-0.5">
      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-pink-50 via-muted to-rose-50">
        <ShoppingBag className="h-12 w-12 text-pink-300" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-foreground/50">{product.brand}</p>
            <h3 className="text-sm font-semibold leading-tight">{product.name}</h3>
          </div>
          <ShortStampBadge score={product.stampScore} size="sm" />
        </div>
        <p className="mt-auto text-lg font-bold text-accent">
          From ${lowestPrice.toFixed(2)}
        </p>
      </div>
    </div>
  );

  if (selectable && onSelect) {
    return (
      <button onClick={() => onSelect(product)} className="text-left">
        {content}
      </button>
    );
  }

  return <Link href={`/product/${product.id}`}>{content}</Link>;
}
