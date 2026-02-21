import { sampleTrends } from "@/lib/data";
import ShortStampBadge from "@/components/ShortStampBadge";
import ProductCard from "@/components/ProductCard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface TrendDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrendDetailPage({ params }: TrendDetailPageProps) {
  const { id } = await params;
  const trend = sampleTrends.find((t) => t.id === id);

  if (!trend) return notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/trends"
<<<<<<< Updated upstream
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-accent"
=======
        className="mb-10 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/40 transition-colors hover:text-accent font-sans"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Products in this Trend</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trend.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Videos placeholder */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Videos</h2>
        <div className="rounded-2xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Video content coming soon — tutorial and review embeds will appear here.
        </div>
      </section>

      {/* Articles placeholder */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Articles</h2>
        <div className="rounded-2xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Related articles and guides will appear here.
        </div>
      </section>
=======
      {trend.products.length > 0 && (
        <section className="mb-20">
          <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">Curated Products</h2>
            <span className="text-xs font-medium text-foreground/40 font-sans">{trend.products.length} Items</span>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {trend.products.map((product) => (
              <ProductCard key={product.id} product={product} />
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
>>>>>>> Stashed changes
    </div>
  );
}
