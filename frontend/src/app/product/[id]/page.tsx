"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Product } from "@/types";
import { api } from "@/lib/api";
import ShortStampBadge from "@/components/ShortStampBadge";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import SaveProductButton from "@/components/SaveProductButton";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!params.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.getProduct(params.id);
        setProduct(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load product";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-foreground/60">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-foreground/60">{error || "Product not found."}</p>
      </div>
    );
  }

  const sorted = [...product.prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sorted[0]?.price;
  const bestRetailer = sorted[0];
  const walmartRetailer = product.prices.find((p) => p.retailer.toLowerCase().includes("walmart"));
  const walmartUrl = product.walmartUrl || walmartRetailer?.url;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <Link
        href="/build"
<<<<<<< Updated upstream
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-accent"
=======
        className="mb-10 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
>>>>>>> Stashed changes
      >
        <ArrowLeft className="h-4 w-4" /> Back to Build
      </Link>

<<<<<<< Updated upstream
      <div className="mb-8 grid gap-8 md:grid-cols-2">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 via-muted to-rose-50 p-6">
=======
      <div className="mb-16 grid gap-12 lg:grid-cols-2">
        <div className="relative aspect-square items-center justify-center overflow-hidden rounded-3xl bg-white p-12 shadow-2xl shadow-accent/5 border border-border/50">
           <div className="absolute top-6 left-6 z-10">
              <ShortStampBadge score={product.stampScore} />
           </div>
>>>>>>> Stashed changes
          <img
            // eslint-disable-next-line @next/next/no-img-element
            src={product.image || "/placeholder-product.jpg"}
<<<<<<< Updated upstream
            alt={product.name}
            className="h-full w-full object-contain"
=======
            alt={getDisplayName(product.name)}
            className="h-full w-full object-contain transition-transform duration-700 hover:scale-105"
>>>>>>> Stashed changes
            onError={(e) => {
              e.currentTarget.src = "/placeholder-product.jpg";
            }}
          />
        </div>

<<<<<<< Updated upstream
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/50">{product.brand}</p>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <ShortStampBadge score={product.stampScore} />
          <p className="text-2xl font-bold text-accent">From ${lowestPrice?.toFixed(2) ?? "0.00"}</p>
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
=======
        <div className="flex flex-col justify-center gap-6">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent font-sans">{getDisplayBrand(product.brand)}</p>
            <h1 className="text-4xl font-bold font-serif leading-tight">{getDisplayName(product.name)}</h1>
          </div>
          
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-foreground font-sans tracking-tight">{formatPrice(bestRetailer?.price)}</p>
            <span className="text-sm font-medium text-foreground/40 font-sans italic">Best Current Price</span>
          </div>

          <div className="h-px w-full bg-border/50" />

          {product.description && (
            <p className="text-base leading-relaxed text-foreground/60 font-sans font-light">{product.description}</p>
>>>>>>> Stashed changes
          )}

          {product.specs && (
            <div className="grid grid-cols-2 gap-4">
              {product.specs.map((spec) => (
                <div key={spec} className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3 border border-border/30">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="text-xs font-semibold font-sans text-foreground/70">{spec}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {bestRetailer && (
              <a
                href={bestRetailer.url}
                target="_blank"
                rel="noopener noreferrer"
<<<<<<< Updated upstream
                className="inline-flex w-full items-center justify-center gap-2 bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                Buy Now - ${lowestPrice?.toFixed(2) ?? "0.00"} at {bestRetailer.retailer}
              </a>
            )}
            {walmartUrl && (
              <a
                href={walmartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 border border-border px-6 py-3 text-sm font-semibold text-foreground transition-all hover:border-accent hover:text-accent"
              >
                View on Walmart
              </a>
            )}
            <SaveProductButton productId={product.id} category={product.category} />
=======
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-8 py-5 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-accent/20 transition-all duration-300 hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-1 font-sans"
              >
                Purchase via {bestRetailer.retailer} 
                <span className="opacity-50 transition-transform group-hover:translate-x-1">&rarr;</span>
              </a>
            )}
            <div className="flex gap-4">
              <SaveProductButton productId={product.id} category={product.category} />
              {walmartUrl && (
                <a
                  href={walmartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/50 bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all duration-300 hover:bg-muted hover:border-accent font-sans"
                >
                  View Walmart
                </a>
              )}
            </div>
>>>>>>> Stashed changes
          </div>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <section className="rounded-3xl border border-border/50 bg-white p-10 shadow-xl shadow-accent/5">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Retailer Comparison</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">{product.prices.length} Retailers</span>
          </div>
          <PriceComparisonTable prices={product.prices} />
        </section>

<<<<<<< Updated upstream
      <section>
        <h2 className="mb-4 text-xl font-semibold">Price History</h2>
        <div className="rounded-2xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Price history chart coming soon - track price changes over time.
        </div>
      </section>
=======
        <section className="rounded-3xl border border-border/50 bg-white p-10 shadow-xl shadow-accent/5">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Price History</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">Last 30 Days</span>
          </div>
          <PriceHistoryChart productId={product.id} />
        </section>
      </div>
>>>>>>> Stashed changes
    </div>
  );
}
