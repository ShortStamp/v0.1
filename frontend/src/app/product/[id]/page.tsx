import { sampleProducts } from "@/lib/data";
import ShortStampBadge from "@/components/ShortStampBadge";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = sampleProducts.find((p) => p.id === id);

  if (!product) return notFound();

  const lowestPrice = Math.min(...product.prices.map((p) => p.price));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/build"
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-8 grid gap-8 md:grid-cols-2">
        {/* Product image placeholder */}
        <div className="flex h-72 items-center justify-center rounded-xl bg-muted">
          <ShoppingBag className="h-20 w-20 text-foreground/15" />
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
        <div className="rounded-xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Price history chart coming soon — track price changes over time.
        </div>
      </section>
    </div>
  );
}
