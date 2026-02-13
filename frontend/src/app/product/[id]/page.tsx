import { sampleProducts } from "@/lib/data";
import ShortStampBadge from "@/components/ShortStampBadge";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import { ArrowLeft, ShoppingBag, Bookmark } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SaveProductButton from "@/components/SaveProductButton";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = sampleProducts.find((p) => p.id === id);

  if (!product) return notFound();

  const sorted = [...product.prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sorted[0]?.price;
  const bestRetailer = sorted[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/build"
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Build
      </Link>

      <div className="mb-8 grid gap-8 md:grid-cols-2">
        {/* Product image placeholder */}
        <div className="flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-50 via-muted to-rose-50">
          <ShoppingBag className="h-20 w-20 text-pink-300" />
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/50">{product.brand}</p>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <ShortStampBadge score={product.stampScore} />
          <p className="text-2xl font-bold text-accent">
            From ${lowestPrice.toFixed(2)}
          </p>
          {product.description && (
            <p className="text-sm text-foreground/60">{product.description}</p>
          )}
          {product.specs && (
            <ul className="mt-2 space-y-1 text-sm text-foreground/60">
              {product.specs.map((spec) => (
                <li key={spec} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {spec}
                </li>
              ))}
            </ul>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-col gap-3">
            {bestRetailer && (
              <a
                href={bestRetailer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                Buy Now — ${lowestPrice.toFixed(2)} at {bestRetailer.retailer}
              </a>
            )}
            <SaveProductButton productId={product.id} category={product.category} />
          </div>
        </div>
      </div>

      {/* Price comparison */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Compare Prices</h2>
        <PriceComparisonTable prices={product.prices} />
      </section>

      {/* Price history placeholder */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Price History</h2>
        <div className="rounded-2xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Price history chart coming soon — track price changes over time.
        </div>
      </section>
    </div>
  );
}
