import Link from "next/link";
import { Product } from "@/types";
import ShortStampBadge from "./ShortStampBadge";
import { formatPrice, getBestOfferForProduct, getDisplayBrand, getDisplayName } from "@/lib/pricing";

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  selectable?: boolean;
}

export default function ProductCard({ product, onSelect, selectable }: ProductCardProps) {
  const bestOffer = getBestOfferForProduct(product);
  const displayBrand = getDisplayBrand(product.brand);
  const displayName = getDisplayName(product.name);

  const content = (
    <div className="group flex flex-col overflow-hidden border border-border bg-background transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      <div className="flex h-48 items-center justify-center bg-muted">
        <img
          src={product.image || "/placeholder-product.jpg"}
          alt={displayName}
          className="h-full w-full object-contain p-4"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-product.jpg";
          }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-foreground/50">{displayBrand}</p>
            <h3 className="text-sm font-semibold leading-tight">{displayName}</h3>
          </div>
          <ShortStampBadge score={product.stampScore} size="sm" />
        </div>
        <p className="mt-auto text-lg font-bold text-foreground">
          {formatPrice(bestOffer?.price)}
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
