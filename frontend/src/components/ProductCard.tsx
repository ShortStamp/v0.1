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
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background transition-all duration-300 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1">
      <div className="relative flex h-56 items-center justify-center bg-muted/30 transition-colors group-hover:bg-muted/50">
        <img
          // eslint-disable-next-line @next/next/no-img-element
          src={product.image || "/placeholder-product.jpg"}
          alt={displayName}
          className="h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-product.jpg";
          }}
        />
        <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <ShortStampBadge score={product.stampScore} size="sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">{displayBrand}</p>
            <h3 className="text-sm font-semibold leading-snug font-serif">{displayName}</h3>
          </div>
          <div className="group-hover:hidden">
            <ShortStampBadge score={product.stampScore} size="sm" />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="text-lg font-bold text-foreground font-sans tracking-tight">
            {formatPrice(bestOffer?.price)}
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent opacity-0 transition-all duration-300 group-hover:opacity-100 font-sans">
            View Details →
          </span>
        </div>
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
