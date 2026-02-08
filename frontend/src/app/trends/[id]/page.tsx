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
        <div className="rounded-xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Video content coming soon — tutorial and review embeds will appear here.
        </div>
      </section>

      {/* Articles placeholder */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Articles</h2>
        <div className="rounded-xl border border-border bg-muted p-8 text-center text-sm text-foreground/40">
          Related articles and guides will appear here.
        </div>
      </section>
    </div>
  );
}
