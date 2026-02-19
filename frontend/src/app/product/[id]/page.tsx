"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Product } from "@/types";
import { api } from "@/lib/api";
import ShortStampBadge from "@/components/ShortStampBadge";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import PriceHistoryChart from "@/components/PriceHistoryChart";
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/build"
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Build
      </Link>

      <div className="mb-8 grid gap-8 md:grid-cols-2">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted p-6">
          <img
            src={product.image || "/placeholder-product.jpg"}
            alt={product.name}
            className="h-full w-full object-contain"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-product.jpg";
            }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/50">{product.brand}</p>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <ShortStampBadge score={product.stampScore} />
          <p className="text-2xl font-bold text-foreground">From ${lowestPrice?.toFixed(2) ?? "0.00"}</p>
          {product.description && (
            <p className="text-sm text-foreground/60">{product.description}</p>
          )}
          {product.specs && (
            <ul className="mt-2 space-y-1 text-sm text-foreground/60">
              {product.specs.map((spec) => (
                <li key={spec} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-foreground" />
                  {spec}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {bestRetailer && (
              <a
                href={bestRetailer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 bg-foreground px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-foreground/90"
              >
                Buy Now - ${lowestPrice?.toFixed(2) ?? "0.00"} at {bestRetailer.retailer}
              </a>
            )}
            {walmartUrl && (
              <a
                href={walmartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 border border-border px-6 py-3 text-sm font-semibold text-foreground transition-all hover:border-foreground"
              >
                View on Walmart
              </a>
            )}
            <SaveProductButton productId={product.id} category={product.category} />
          </div>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Compare Prices</h2>
        <PriceComparisonTable prices={product.prices} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Price History</h2>
        <PriceHistoryChart productId={product.id} />
      </section>
    </div>
  );
}
