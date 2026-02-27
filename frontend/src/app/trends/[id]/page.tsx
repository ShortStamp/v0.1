"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ShortStampBadge from "@/components/ShortStampBadge";
import ProductCard from "@/components/ProductCard";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Trend } from "@/types";

export default function TrendDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trend, setTrend] = useState<Trend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getTrend(id)
      .then(setTrend)
      .catch(() => setTrend(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-foreground/40">Loading trend...</p>
      </div>
    );
  }

  if (!trend) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-foreground/40">Trend not found.</p>
        <Link href="/trends" className="text-sm underline hover:text-foreground">
          Back to Trends
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/trends"
        className="mb-10 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Trends
      </Link>

      <div className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <div className="inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">
              Trending Aesthetic
            </p>
          </div>
          <h1 className="text-5xl font-bold font-serif leading-tight">{trend.name}</h1>
          <p className="text-lg leading-relaxed text-foreground/60 font-sans font-light">{trend.description}</p>
        </div>
        <div className="shrink-0">
          <ShortStampBadge score={trend.stampScore} direction={trend.direction} />
        </div>
      </div>

      {/* Products */}
      {trend.products.length > 0 && (
        <section className="mb-20">
          <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Curated Products</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">{trend.products.length} Items</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {trend.products.map((product) => (
              <div key={product.id} className="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Videos */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Community Content</h2>
          </div>
          {trend.videos && trend.videos.length > 0 ? (
            <div className="grid gap-4">
              {trend.videos.map((video, i) => (
                <a
                  key={i}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-border/50 bg-white p-5 transition-all duration-300 hover:border-accent hover:shadow-xl hover:shadow-accent/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold font-serif">{video.title || "Watch on Social Media"}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent opacity-0 transition-opacity group-hover:opacity-100 font-sans">View &rarr;</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/50 bg-muted/30 p-12 text-center text-sm text-foreground/30 font-sans">
              Video guides coming soon.
            </div>
          )}
        </section>

        {/* Articles */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Further Reading</h2>
          </div>
          {trend.articles && trend.articles.length > 0 ? (
            <div className="grid gap-4">
              {trend.articles.map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-border/50 bg-white p-5 transition-all duration-300 hover:border-accent hover:shadow-xl hover:shadow-accent/5"
                >
                   <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold font-serif">{article.title}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent opacity-0 transition-opacity group-hover:opacity-100 font-sans">Read &rarr;</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/50 bg-muted/30 p-12 text-center text-sm text-foreground/30 font-sans">
              Expert articles will appear here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
