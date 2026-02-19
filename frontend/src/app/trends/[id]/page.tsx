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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/trends"
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Trends
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{trend.name}</h1>
          <p className="mt-2 text-foreground/60">{trend.description}</p>
        </div>
        <ShortStampBadge score={trend.stampScore} direction={trend.direction} />
      </div>

      {/* Products */}
      {trend.products.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Products in this Trend</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trend.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Videos */}
      {trend.videos && trend.videos.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Videos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {trend.videos.map((video, i) => (
              <a
                key={i}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border border-border p-4 transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4 shrink-0 text-foreground/40" />
                <span className="text-sm font-medium">{video.title || "Watch Video"}</span>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Videos</h2>
          <div className="border border-border bg-muted p-8 text-center text-sm text-foreground/40">
            Video content coming soon.
          </div>
        </section>
      )}

      {/* Articles */}
      {trend.articles && trend.articles.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Articles</h2>
          <div className="grid gap-3">
            {trend.articles.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border border-border p-4 transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4 shrink-0 text-foreground/40" />
                <span className="text-sm font-medium">{article.title}</span>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Articles</h2>
          <div className="border border-border bg-muted p-8 text-center text-sm text-foreground/40">
            Related articles will appear here.
          </div>
        </section>
      )}
    </div>
  );
}
