'use client';

import { useMemo } from 'react';
import FilterBar from '@/components/FilterBar';
import AddToBagCard from '@/components/AddToBagCard';
import Navbar from '@/components/Navbar';
import PriceComparisonTable from '@/components/PriceComparisonTable';
import ProductCard from '@/components/ProductCard';
import ProductPicker from '@/components/ProductPicker';
import Providers from '@/components/Providers';
import SaveProductButton from '@/components/SaveProductButton';
import ShortStampBadge from '@/components/ShortStampBadge';
import StartBuildingButton from '@/components/StartBuildingButton';
import Toolbox from '@/components/Toolbox';
import TrendCard from '@/components/TrendCard';
import { Product, ToolboxSlot, Trend } from '@/types';

function Section({
  title,
  children,
  demo = true,
}: {
  title: string;
  children: React.ReactNode;
  demo?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/60">
        {title}
      </h2>
      <div className={demo ? 'style-preview' : ''}>{children}</div>
    </section>
  );
}

export default function StyleGuidePage() {
  const demoProduct = useMemo<Product>(
    () => ({
      id: 'demo-foundation-1',
      name: 'Luminous Skin Foundation',
      brand: 'ShortStamp Labs',
      image: '/placeholder-product.jpg',
      category: 'foundation',
      stampScore: 92,
      description: 'Medium coverage with a satin finish.',
      prices: [
        {
          retailer: 'Sephora',
          price: 42,
          url: '#',
          inStock: true,
        },
        {
          retailer: 'Ulta',
          price: 39,
          url: '#',
          inStock: false,
        },
        {
          retailer: 'Target',
          price: 37.5,
          url: '#',
          inStock: true,
        },
      ],
      reviews: [
        {
          author: 'Demo User',
          rating: 4.5,
          text: 'Blends quickly and lasts all day.',
        },
      ],
      filters: {
        finish: 'Satin',
        coverage: 'Medium',
        crueltyFree: true,
      },
    }),
    []
  );

  const demoTrend = useMemo<Trend>(
    () => ({
      id: 'trend-glass-skin',
      name: 'Glass Skin Finish',
      image: '/placeholder-trend.jpg',
      stampScore: 88,
      description: 'Dewy complexion products and lightweight layers.',
      direction: 'rising',
      products: [demoProduct],
      videos: ['https://example.com/video'],
      articles: [{ title: 'Why dewy makeup is back', url: 'https://example.com/article' }],
    }),
    [demoProduct]
  );

  const demoSlots = useMemo<ToolboxSlot[]>(
    () => [
      { category: 'foundation', product: demoProduct },
      {
        category: 'concealer',
        product: {
          ...demoProduct,
          id: 'demo-concealer-1',
          name: 'Soft Blur Concealer',
          category: 'concealer',
          stampScore: 86,
          prices: [{ retailer: 'Ulta', price: 25, url: '#', inStock: true }],
        },
      },
      { category: 'powder', product: null },
    ],
    [demoProduct]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-pink-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
            Frontend Style Guide
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">All Current Components</h1>
          <p className="text-sm text-foreground/60">
            Single-page reference for everything in <code>src/components</code>.
          </p>
        </header>

        <div className="space-y-4">
          <Section title="Navbar">
            <div className="overflow-hidden rounded-xl border border-border">
              <Navbar />
            </div>
          </Section>

          <Section title="Providers">
            <Providers>
              <div className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-foreground/70">
                Providers is a wrapper component that injects context for children.
              </div>
            </Providers>
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="FilterBar">
            <FilterBar activeFilter="All Trends" onFilterChange={() => {}} />
          </Section>

          <Section title="StartBuildingButton">
            <StartBuildingButton />
          </Section>

          <Section title="ShortStampBadge">
            <div className="flex flex-wrap gap-3">
              <ShortStampBadge score={94} direction="rising" />
              <ShortStampBadge score={81} direction="stable" />
              <ShortStampBadge score={69} direction="declining" />
              <ShortStampBadge score={76} size="sm" />
            </div>
          </Section>

          <Section title="SaveProductButton">
            <SaveProductButton productId={demoProduct.id} category="foundation" />
          </Section>

          <Section title="PriceComparisonTable">
            <PriceComparisonTable prices={demoProduct.prices} />
          </Section>

          <Section title="Toolbox">
            <Toolbox slots={demoSlots} />
          </Section>

          <Section title="ProductCard">
            <div className="max-w-xs">
              <ProductCard product={demoProduct} />
            </div>
          </Section>

          <Section title="TrendCard">
            <div className="max-w-xs">
              <TrendCard trend={demoTrend} />
            </div>
          </Section>

          <Section title="AddToBagCard">
            <div className="max-w-xs">
              <AddToBagCard product={demoProduct} onAddToBag={() => {}} />
            </div>
          </Section>
        </div>

        <Section title="ProductPicker">
          <div className="picker-preview">
            <ProductPicker categoryKey="foundation" onSelect={() => {}} onClose={() => {}} />
          </div>
        </Section>

        <Section title="Text Comparison" demo={false}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/50">Display</p>
              <p className="text-4xl font-bold leading-tight">ShortStamp</p>
              <p className="mt-2 text-sm text-foreground/60">For hero headings and major calls.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/50">Body</p>
              <p className="text-base leading-relaxed">
                Clean ingredient breakdowns, price checks, and trend context in a readable paragraph.
              </p>
              <p className="mt-2 text-sm text-foreground/60">Default content rhythm.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/50">UI Labels</p>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">Save to Build</p>
              <p className="mt-2 text-sm text-foreground/60">Buttons, tabs, and metadata labels.</p>
            </div>
          </div>
        </Section>

        <Section title="Color Palette" demo={false}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Background', variable: '--background', hex: '#FFFAFB', swatch: 'bg-background' },
              { name: 'Foreground', variable: '--foreground', hex: '#2D2D2D', swatch: 'bg-foreground' },
              { name: 'Accent', variable: '--accent', hex: '#E84B8A', swatch: 'bg-accent' },
              { name: 'Accent Light', variable: '--accent-light', hex: '#F9A8D0', swatch: 'bg-accent-light' },
              { name: 'Secondary', variable: '--secondary', hex: '#D946A8', swatch: 'bg-secondary' },
              { name: 'Muted', variable: '--muted', hex: '#FFF0F5', swatch: 'bg-muted' },
              { name: 'Border', variable: '--border', hex: '#FECDD6', swatch: 'bg-border' },
              { name: 'Pink Deep', variable: '--pink-deep', hex: '#BE185D', swatch: 'bg-pink-deep' },
              { name: 'Pink Soft', variable: '--pink-soft', hex: '#FBCFE8', swatch: 'bg-pink-soft' },
            ].map((color) => (
              <div key={color.variable} className="rounded-xl border border-border bg-background p-3">
                <div className={`h-16 w-full rounded-lg border border-border ${color.swatch}`} />
                <p className="mt-3 text-sm font-semibold">{color.name}</p>
                <p className="text-xs text-foreground/60">{color.variable}</p>
                <p className="text-xs text-foreground/60">{color.hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Font A/B Test" demo={false}>
          <p className="mb-5 text-sm text-foreground/60">
            Each card renders identical copy in a different typeface. Compare display heading, body
            paragraph, and UI label behaviour side-by-side.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                id: 'helvetica',
                label: 'Helvetica Neue',
                sub: 'System sans-serif · current default',
                style: { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
              },
              {
                id: 'montserrat',
                label: 'Montserrat',
                sub: 'Geometric sans · beauty-brand staple',
                style: { fontFamily: '"Montserrat", sans-serif' },
              },
              {
                id: 'josefin',
                label: 'Josefin Sans',
                sub: 'Geometric uppercase · editorial clean',
                style: { fontFamily: '"Josefin Sans", sans-serif' },
              },
              {
                id: 'raleway',
                label: 'Raleway',
                sub: 'Thin elegant sans · airy luxury',
                style: { fontFamily: '"Raleway", sans-serif' },
              },
              {
                id: 'playfair',
                label: 'Playfair Display',
                sub: 'High-contrast serif · fashion editorial',
                style: { fontFamily: '"Playfair Display", serif' },
              },
              {
                id: 'cormorant',
                label: 'Cormorant Garamond',
                sub: 'Ultra-fine serif · Vogue / Chanel tier',
                style: { fontFamily: '"Cormorant Garamond", serif' },
              },
              {
                id: 'dm-serif',
                label: 'DM Serif Display',
                sub: 'Ink-trap serif · bold editorial',
                style: { fontFamily: '"DM Serif Display", serif' },
              },
              {
                id: 'libre',
                label: 'Libre Baskerville',
                sub: 'Classic book serif · trustworthy warmth',
                style: { fontFamily: '"Libre Baskerville", serif' },
              },
            ].map((font) => (
              <div
                key={font.id}
                className="rounded-xl border border-border bg-background p-5 space-y-4"
                style={font.style}
              >
                <div className="border-b border-border pb-3">
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-foreground/40 mb-1">
                    {font.label}
                  </p>
                  <p className="text-[10px] font-sans text-foreground/30">{font.sub}</p>
                </div>

                {/* Display / Hero */}
                <div>
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] text-foreground/40 mb-1">
                    Display
                  </p>
                  <p className="text-3xl font-bold leading-tight">ShortStamp</p>
                  <p className="text-lg font-light tracking-wide">Makeup</p>
                </div>

                {/* Section heading */}
                <div>
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] text-foreground/40 mb-1">
                    Heading
                  </p>
                  <p className="text-base font-semibold leading-snug">
                    Your perfect foundation, found.
                  </p>
                </div>

                {/* Body */}
                <div>
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] text-foreground/40 mb-1">
                    Body
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/70">
                    Medium coverage with a satin finish. Dermatologist-tested and cruelty-free.
                    Blends quickly and lasts all day.
                  </p>
                </div>

                {/* UI label */}
                <div>
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] text-foreground/40 mb-1">
                    UI Label
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] bg-foreground text-background px-3 py-1.5 rounded">
                      Add to Build
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] border border-foreground px-3 py-1.5 rounded">
                      View All
                    </span>
                  </div>
                </div>

                {/* Price / metadata */}
                <div>
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] text-foreground/40 mb-1">
                    Metadata
                  </p>
                  <p className="text-lg font-bold">$42.00</p>
                  <p className="text-xs text-foreground/50 tracking-wide">Stamp Score · 92</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Interaction Policy" demo={false}>
          <div className="space-y-3">
            <p className="text-sm text-foreground/60">
              On this style page, all component links and buttons are intentionally non-live.
            </p>
          </div>
        </Section>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Josefin+Sans:wght@300;400;600;700&family=Raleway:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Serif+Display&family=Libre+Baskerville:wght@400;700&display=swap');

        .style-preview a {
          pointer-events: none;
          cursor: default;
        }

        .picker-preview > div.fixed {
          position: relative !important;
          inset: auto !important;
          z-index: 1 !important;
          height: 34rem;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 0.75rem;
        }
      `}</style>
    </main>
  );
}
