import { FaceCategory, Product, Trend } from "@/types";

export const faceCategories: FaceCategory[] = [
  {
    region: "eyes",
    label: "Eyes",
    categories: ["Eyeshadow", "Eyeliner", "Eye Primer"],
  },
  {
    region: "lashes",
    label: "Lashes",
    categories: ["Mascara", "False Lashes", "Lash Serum"],
  },
  {
    region: "brows",
    label: "Brows",
    categories: ["Brow Pencil", "Brow Gel", "Brow Pomade"],
  },
  {
    region: "lips",
    label: "Lips",
    categories: ["Lipstick", "Lip Gloss", "Lip Liner", "Lip Stain"],
  },
  {
    region: "cheeks",
    label: "Cheeks",
    categories: ["Blush", "Bronzer", "Highlighter", "Contour"],
  },
  {
    region: "skin",
    label: "Skin",
    categories: ["Foundation", "Concealer", "Primer", "Setting Spray", "Powder"],
  },
];

export const sampleProducts: Product[] = [
  {
    id: "1",
    name: "Soft Matte Eyeshadow Palette",
    brand: "Urban Decay",
    image: "/placeholder-product.jpg",
    category: "Eyeshadow",
    region: "eyes",
    stampScore: 92,
    prices: [
      { retailer: "Sephora", price: 54.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 52.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 48.99, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 54.0, url: "#", inStock: false },
    ],
    description:
      "A versatile eyeshadow palette with 12 highly pigmented shades ranging from matte neutrals to shimmer finishes.",
    specs: ["12 shades", "Matte & shimmer finishes", "Vegan formula", "Mirror included"],
  },
  {
    id: "2",
    name: "Lip Glow Oil",
    brand: "Dior",
    image: "/placeholder-product.jpg",
    category: "Lip Gloss",
    region: "lips",
    stampScore: 97,
    prices: [
      { retailer: "Sephora", price: 40.0, url: "#", inStock: true },
      { retailer: "Dior.com", price: 40.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 40.0, url: "#", inStock: true },
    ],
    description:
      "A nourishing lip oil that enhances natural lip color with a glossy, non-sticky finish.",
    specs: ["Cherry oil infused", "Color-reviving", "6 shades available"],
  },
  {
    id: "3",
    name: "Cloud Paint",
    brand: "Glossier",
    image: "/placeholder-product.jpg",
    category: "Blush",
    region: "cheeks",
    stampScore: 88,
    prices: [
      { retailer: "Glossier.com", price: 20.0, url: "#", inStock: true },
      { retailer: "Sephora", price: 20.0, url: "#", inStock: true },
    ],
    description: "A seamless, buildable gel-cream blush that gives a natural flush of color.",
    specs: ["Gel-cream formula", "Buildable coverage", "8 shades"],
  },
  {
    id: "4",
    name: "Brow Wiz",
    brand: "Anastasia Beverly Hills",
    image: "/placeholder-product.jpg",
    category: "Brow Pencil",
    region: "brows",
    stampScore: 85,
    prices: [
      { retailer: "Sephora", price: 25.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 25.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 22.5, url: "#", inStock: true },
    ],
    description:
      "An ultra-slim, retractable pencil for precise, hair-like strokes.",
    specs: ["Ultra-fine tip", "Built-in spoolie", "12 shades"],
  },
  {
    id: "5",
    name: "Lash Sensational Mascara",
    brand: "Maybelline",
    image: "/placeholder-product.jpg",
    category: "Mascara",
    region: "lashes",
    stampScore: 80,
    prices: [
      { retailer: "Ulta Beauty", price: 9.99, url: "#", inStock: true },
      { retailer: "Amazon", price: 7.98, url: "#", inStock: true },
      { retailer: "Target", price: 9.99, url: "#", inStock: true },
    ],
    description:
      "A fan-effect mascara that layers lashes with volume, length, and a full-fan effect.",
    specs: ["Fanning brush", "Rose oil formula", "Washable"],
  },
  {
    id: "6",
    name: "Luminous Silk Foundation",
    brand: "Giorgio Armani",
    image: "/placeholder-product.jpg",
    category: "Foundation",
    region: "skin",
    stampScore: 94,
    prices: [
      { retailer: "Sephora", price: 65.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 65.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 59.0, url: "#", inStock: true },
    ],
    description:
      "An award-winning lightweight foundation that delivers buildable, luminous coverage.",
    specs: ["Micro-fil technology", "40 shades", "Oil-free"],
  },
];

export const sampleTrends: Trend[] = [
  {
    id: "1",
    name: "Clean Girl Aesthetic",
    image: "/placeholder-trend.jpg",
    stampScore: 95,
    description:
      "A minimalist, fresh-faced look emphasizing dewy skin, brushed brows, and subtle lip color.",
    direction: "rising",
    products: [sampleProducts[2], sampleProducts[1], sampleProducts[5]],
  },
  {
    id: "2",
    name: "Soft Glam",
    image: "/placeholder-trend.jpg",
    stampScore: 89,
    description:
      "Warm-toned eyeshadows, defined brows, and nude lips for an elevated everyday look.",
    direction: "stable",
    products: [sampleProducts[0], sampleProducts[3], sampleProducts[1]],
  },
  {
    id: "3",
    name: "Glass Skin",
    image: "/placeholder-trend.jpg",
    stampScore: 91,
    description:
      "Ultra-dewy, translucent skin that looks like glass — achieved with hydrating primers and luminous foundations.",
    direction: "rising",
    products: [sampleProducts[5], sampleProducts[2]],
  },
];
