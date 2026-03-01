"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Product, ProductVariant } from "@/types";
import { api } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import ShortStampBadge from "@/components/ShortStampBadge";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import SaveProductButton from "@/components/SaveProductButton";
import { formatPrice, getBestOffer, getDisplayBrand, getDisplayName } from "@/lib/pricing";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!params.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.getProduct(params.id);
        setProduct(data);
        // Select the default variant if one exists
        const defaultVariant = data.variants?.find((v) => v.isDefault) ?? data.variants?.[0] ?? null;
        setSelectedVariant(defaultVariant);
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

  // Build image gallery: main image + extra images
  const allImages: string[] = [
    product.image || "/placeholder-product.jpg",
    ...(product.extraImageUrls ?? []),
  ];

  // If the selected variant has its own image, show it as the main display
  const displayImage = selectedVariant?.imageUrl || allImages[activeImageIndex] || "/placeholder-product.jpg";

  const bestRetailer = getBestOffer(product.prices);
  const walmartRetailer = product.prices.find((p) => p.retailer.toLowerCase().includes("walmart"));
  const walmartUrl = product.walmartUrl || walmartRetailer?.url;

  const hasVariants = product.variants && product.variants.length > 0;
  const hasIngredients = product.inciIngredients && product.inciIngredients.length > 0;
  const hasMultipleImages = allImages.length > 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/build"
        className="mb-10 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Build
      </Link>

      <div className="mb-16 grid gap-12 lg:grid-cols-2">
        {/* Image Gallery */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-square items-center justify-center overflow-hidden rounded-3xl bg-white p-12 shadow-2xl shadow-accent/5 border border-border/50">
            <div className="absolute top-6 left-6 z-10">
              <ShortStampBadge score={product.stampScore} />
            </div>
            <img
              src={displayImage}
              alt={getDisplayName(product.name)}
              className="h-full w-full object-contain transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-product.jpg";
              }}
            />
          </div>

          {/* Thumbnail strip */}
          {hasMultipleImages && !selectedVariant?.imageUrl && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-2 transition-all duration-200 ${
                    activeImageIndex === i
                      ? "border-accent shadow-lg shadow-accent/20"
                      : "border-border/30 hover:border-accent/50"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${getDisplayName(product.name)} view ${i + 1}`}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-product.jpg";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
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

          {/* Purchase CTAs */}
          <div className="flex flex-col gap-4">
            {bestRetailer && (
              <a
                href={bestRetailer.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  analytics.affiliateLinkClicked({
                    product_id: product.id,
                    product_name: product.name,
                    retailer: bestRetailer.retailer,
                  })
                }
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-8 py-5 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-accent/20 transition-all duration-300 hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-1 font-sans"
              >
                Purchase via {bestRetailer.retailer}
                <span className="opacity-50 transition-transform group-hover:translate-x-1">&rarr;</span>
              </a>
            )}
            <div className="flex gap-4">
              <SaveProductButton productId={product.id} category={product.category} product={product} />
              {walmartUrl && (
                <a
                  href={walmartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    analytics.affiliateLinkClicked({
                      product_id: product.id,
                      product_name: product.name,
                      retailer: "Walmart",
                    })
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/50 bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all duration-300 hover:bg-muted hover:border-accent font-sans"
                >
                  View Walmart
                </a>
              )}
            </div>
          </div>

          {/* Variant / Shade selector */}
          {hasVariants && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Shade</p>
                {selectedVariant?.shadeName && (
                  <p className="text-sm font-semibold text-foreground font-sans">{selectedVariant.shadeName}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants!.map((variant, i) => {
                  const isActive = selectedVariant === variant;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedVariant(variant);
                        // Reset thumbnail selection when a variant with its own image is picked
                        if (variant.imageUrl) setActiveImageIndex(0);
                      }}
                      className={`group/swatch relative h-9 w-9 rounded-full border-2 transition-all duration-200 ${
                        isActive
                          ? "border-accent shadow-lg shadow-accent/20 scale-110"
                          : "border-border/30 hover:border-accent/50 hover:scale-105"
                      }`}
                      title={variant.shadeName ?? `Shade ${i + 1}`}
                    >
                      <span
                        className="absolute inset-1 rounded-full"
                        style={{ backgroundColor: variant.hexColor || "#ccc" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-px w-full bg-border/50" />

          {product.description && (
            <p className="text-base leading-relaxed text-foreground/60 font-sans font-light">{product.description}</p>
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
        </div>
      </div>

      {/* Ingredients Section */}
      {hasIngredients && (
        <section className="mb-16 rounded-3xl border border-border/50 bg-white p-10 shadow-xl shadow-accent/5">
          <h2 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Ingredients</h2>
          <p className="text-sm leading-relaxed text-foreground/60 font-sans font-light">
            {product.inciIngredients!.join(", ")}
          </p>
        </section>
      )}

      {/* Price Comparison & History */}
      <div className="grid gap-12 lg:grid-cols-2">
        <section className="rounded-3xl border border-border/50 bg-white p-10 shadow-xl shadow-accent/5">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Retailer Comparison</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">{product.prices.length} Retailers</span>
          </div>
          <PriceComparisonTable prices={product.prices} />
        </section>

        <section className="rounded-3xl border border-border/50 bg-white p-10 shadow-xl shadow-accent/5">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Price History</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">Last 30 Days</span>
          </div>
          <PriceHistoryChart productId={product.id} />
        </section>
      </div>
    </div>
  );
}
