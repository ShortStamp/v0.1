import { CategoryDefinition, CategoryGroup, CategoryKey, Product, ProductFilter, Trend } from "@/types";

const commonFilters: ProductFilter[] = [
  { key: "brand", label: "Brand", type: "checkbox", options: [] },
  { key: "priceRange", label: "Price Range", type: "range" },
];

function withCommon(filters: ProductFilter[], brands: string[]): ProductFilter[] {
  return [
    { ...commonFilters[0], options: brands },
    commonFilters[1],
    ...filters,
  ];
}

export const categoryDefinitions: CategoryDefinition[] = [
  {
    key: "foundation",
    label: "Foundation",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Dewy", "Satin"] },
        { key: "coverage", label: "Coverage", type: "checkbox", options: ["Light", "Medium", "Full"] },
        { key: "skinType", label: "Skin Type", type: "checkbox", options: ["Oily", "Dry", "Combination", "Normal"] },
      ],
      ["Giorgio Armani", "Maybelline", "NARS"]
    ),
  },
  {
    key: "concealer",
    label: "Concealer",
    filters: withCommon(
      [
        { key: "coverage", label: "Coverage", type: "checkbox", options: ["Light", "Medium", "Full"] },
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Dewy", "Natural"] },
        { key: "undertone", label: "Undertone", type: "checkbox", options: ["Warm", "Cool", "Neutral"] },
      ],
      ["NARS", "Tarte", "Maybelline"]
    ),
  },
  {
    key: "primer",
    label: "Primer",
    filters: withCommon(
      [
        { key: "type", label: "Type", type: "checkbox", options: ["Hydrating", "Mattifying", "Pore-Filling", "Color-Correcting"] },
      ],
      ["Tatcha", "Smashbox", "e.l.f."]
    ),
  },
  {
    key: "powder",
    label: "Powder",
    filters: withCommon(
      [
        { key: "type", label: "Type", type: "checkbox", options: ["Pressed", "Loose"] },
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Luminous"] },
      ],
      ["Laura Mercier", "Maybelline", "Charlotte Tilbury"]
    ),
  },
  {
    key: "blush",
    label: "Blush",
    filters: withCommon(
      [
        { key: "formula", label: "Formula", type: "checkbox", options: ["Powder", "Cream", "Liquid"] },
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Shimmer", "Satin"] },
      ],
      ["Glossier", "NARS", "Rare Beauty"]
    ),
  },
  {
    key: "bronzer",
    label: "Bronzer",
    filters: withCommon(
      [
        { key: "formula", label: "Formula", type: "checkbox", options: ["Powder", "Cream"] },
        { key: "shimmer", label: "Shimmer", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Benefit", "Physician's Formula", "Too Faced"]
    ),
  },
  {
    key: "highlighter",
    label: "Highlighter",
    filters: withCommon(
      [
        { key: "formula", label: "Formula", type: "checkbox", options: ["Powder", "Cream", "Liquid"] },
        { key: "intensity", label: "Intensity", type: "checkbox", options: ["Subtle", "Blinding"] },
      ],
      ["Fenty Beauty", "Becca", "Dior"]
    ),
  },
  {
    key: "contour",
    label: "Contour",
    filters: withCommon(
      [
        { key: "formula", label: "Formula", type: "checkbox", options: ["Powder", "Cream", "Stick"] },
      ],
      ["Fenty Beauty", "KVD Vegan Beauty", "NYX"]
    ),
  },
  {
    key: "eyeshadow",
    label: "Eyeshadow",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Shimmer", "Glitter"] },
        { key: "paletteSize", label: "Palette Size", type: "checkbox", options: ["Single", "Quad", "6+", "12+"] },
        { key: "colorFamily", label: "Color Family", type: "checkbox", options: ["Neutral", "Warm", "Cool", "Colorful"] },
      ],
      ["Urban Decay", "Anastasia Beverly Hills", "Natasha Denona"]
    ),
  },
  {
    key: "eyeliner",
    label: "Eyeliner",
    filters: withCommon(
      [
        { key: "type", label: "Type", type: "checkbox", options: ["Pencil", "Liquid", "Gel", "Felt-tip"] },
        { key: "waterproof", label: "Waterproof", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Stila", "NYX", "Maybelline"]
    ),
  },
  {
    key: "mascara",
    label: "Mascara",
    filters: withCommon(
      [
        { key: "effect", label: "Effect", type: "checkbox", options: ["Volume", "Length", "Curl"] },
        { key: "waterproof", label: "Waterproof", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Maybelline", "Too Faced", "Lancôme"]
    ),
  },
  {
    key: "false-lashes",
    label: "False Lashes",
    filters: withCommon(
      [
        { key: "style", label: "Style", type: "checkbox", options: ["Natural", "Dramatic", "Wispy"] },
        { key: "material", label: "Material", type: "checkbox", options: ["Synthetic", "Mink", "Silk"] },
      ],
      ["Ardell", "Lilly Lashes", "Kiss"]
    ),
  },
  {
    key: "brow-pencil",
    label: "Brow Pencil",
    filters: withCommon(
      [
        { key: "tipType", label: "Tip Type", type: "checkbox", options: ["Ultra-fine", "Angled"] },
        { key: "spoolie", label: "Spoolie", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Anastasia Beverly Hills", "Benefit", "NYX"]
    ),
  },
  {
    key: "brow-gel",
    label: "Brow Gel",
    filters: withCommon(
      [
        { key: "tinted", label: "Tinted", type: "checkbox", options: ["Yes", "No"] },
        { key: "hold", label: "Hold", type: "checkbox", options: ["Light", "Strong"] },
      ],
      ["Glossier", "Benefit", "Got2b"]
    ),
  },
  {
    key: "lipstick",
    label: "Lipstick",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Satin", "Glossy"] },
        { key: "type", label: "Type", type: "checkbox", options: ["Bullet", "Liquid"] },
        { key: "longWear", label: "Long-wear", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["MAC", "Charlotte Tilbury", "Maybelline"]
    ),
  },
  {
    key: "lip-gloss",
    label: "Lip Gloss",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Shimmer", "Clear", "Cream"] },
        { key: "tinted", label: "Tinted", type: "checkbox", options: ["Yes", "No"] },
        { key: "plumping", label: "Plumping", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Dior", "Fenty Beauty", "NYX"]
    ),
  },
  {
    key: "lip-liner",
    label: "Lip Liner",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Creamy"] },
        { key: "retractable", label: "Retractable", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Charlotte Tilbury", "MAC", "NYX"]
    ),
  },
  {
    key: "setting-spray",
    label: "Setting Spray",
    filters: withCommon(
      [
        { key: "finish", label: "Finish", type: "checkbox", options: ["Matte", "Dewy", "Natural"] },
        { key: "longWear", label: "Long-wear", type: "checkbox", options: ["Yes", "No"] },
      ],
      ["Urban Decay", "NYX", "Charlotte Tilbury"]
    ),
  },
];

export const categoryGroups: CategoryGroup[] = [
  { key: "base", label: "Base", categories: ["foundation", "concealer", "primer", "powder", "setting-spray"] },
  { key: "eyes", label: "Eyes", categories: ["eyeshadow", "eyeliner", "mascara", "false-lashes"] },
  { key: "brows", label: "Brows", categories: ["brow-pencil", "brow-gel"] },
  { key: "cheeks", label: "Cheeks", categories: ["contour", "bronzer", "blush", "highlighter"] },
  { key: "lips", label: "Lips", categories: ["lip-liner", "lipstick", "lip-gloss"] },
];

export const categoryMap: Record<CategoryKey, CategoryDefinition> = Object.fromEntries(
  categoryDefinitions.map((c) => [c.key, c])
) as Record<CategoryKey, CategoryDefinition>;

export const sampleProducts: Product[] = [
  // Foundation
  {
    id: "1",
    name: "Luminous Silk Foundation",
    brand: "Giorgio Armani",
    image: "/placeholder-product.jpg",
    category: "foundation",
    stampScore: 94,
    prices: [
      { retailer: "Sephora", price: 65.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 65.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 59.0, url: "#", inStock: true },
    ],
    description: "An award-winning lightweight foundation that delivers buildable, luminous coverage.",
    specs: ["Micro-fil technology", "40 shades", "Oil-free"],
    filters: { finish: "Satin", coverage: "Medium", skinType: "Normal" },
  },
  {
    id: "2",
    name: "Fit Me Matte + Poreless",
    brand: "Maybelline",
    image: "/placeholder-product.jpg",
    category: "foundation",
    stampScore: 82,
    prices: [
      { retailer: "Ulta Beauty", price: 9.49, url: "#", inStock: true },
      { retailer: "Amazon", price: 7.99, url: "#", inStock: true },
    ],
    description: "A lightweight foundation that mattifies and refines pores for a natural finish.",
    filters: { finish: "Matte", coverage: "Medium", skinType: "Oily" },
  },
  // Concealer
  {
    id: "3",
    name: "Radiant Creamy Concealer",
    brand: "NARS",
    image: "/placeholder-product.jpg",
    category: "concealer",
    stampScore: 91,
    prices: [
      { retailer: "Sephora", price: 32.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 32.0, url: "#", inStock: true },
    ],
    description: "A multi-action concealer that corrects, contours, highlights, and perfects.",
    filters: { coverage: "Medium", finish: "Dewy", undertone: "Neutral" },
  },
  {
    id: "4",
    name: "Shape Tape Concealer",
    brand: "Tarte",
    image: "/placeholder-product.jpg",
    category: "concealer",
    stampScore: 88,
    prices: [
      { retailer: "Ulta Beauty", price: 30.0, url: "#", inStock: true },
      { retailer: "Tarte.com", price: 30.0, url: "#", inStock: true },
    ],
    description: "Full-coverage concealer with a matte finish for a flawless look.",
    filters: { coverage: "Full", finish: "Matte", undertone: "Warm" },
  },
  // Primer
  {
    id: "5",
    name: "The Silk Canvas",
    brand: "Tatcha",
    image: "/placeholder-product.jpg",
    category: "primer",
    stampScore: 90,
    prices: [
      { retailer: "Sephora", price: 52.0, url: "#", inStock: true },
      { retailer: "Tatcha.com", price: 52.0, url: "#", inStock: true },
    ],
    description: "A velvety primer balm that fills pores and smooths skin.",
    filters: { type: "Pore-Filling" },
  },
  {
    id: "6",
    name: "Photo Finish Primer",
    brand: "Smashbox",
    image: "/placeholder-product.jpg",
    category: "primer",
    stampScore: 84,
    prices: [
      { retailer: "Sephora", price: 39.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 39.0, url: "#", inStock: true },
    ],
    description: "A lightweight, oil-free primer that smooths and blurs for a photo-ready finish.",
    filters: { type: "Pore-Filling" },
  },
  // Powder
  {
    id: "7",
    name: "Translucent Loose Setting Powder",
    brand: "Laura Mercier",
    image: "/placeholder-product.jpg",
    category: "powder",
    stampScore: 93,
    prices: [
      { retailer: "Sephora", price: 43.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 43.0, url: "#", inStock: true },
    ],
    description: "A lightweight, silky powder that sets makeup for up to 16 hours.",
    filters: { type: "Loose", finish: "Matte" },
  },
  {
    id: "8",
    name: "Airspun Loose Face Powder",
    brand: "Coty",
    image: "/placeholder-product.jpg",
    category: "powder",
    stampScore: 78,
    prices: [
      { retailer: "Amazon", price: 8.97, url: "#", inStock: true },
      { retailer: "Walmart", price: 7.97, url: "#", inStock: true },
    ],
    description: "A classic loose powder that provides a flawless, soft finish.",
    filters: { type: "Loose", finish: "Matte" },
  },
  // Blush
  {
    id: "9",
    name: "Cloud Paint",
    brand: "Glossier",
    image: "/placeholder-product.jpg",
    category: "blush",
    stampScore: 88,
    prices: [
      { retailer: "Glossier.com", price: 20.0, url: "#", inStock: true },
      { retailer: "Sephora", price: 20.0, url: "#", inStock: true },
    ],
    description: "A seamless, buildable gel-cream blush that gives a natural flush of color.",
    filters: { formula: "Cream", finish: "Satin" },
  },
  {
    id: "10",
    name: "Soft Pinch Liquid Blush",
    brand: "Rare Beauty",
    image: "/placeholder-product.jpg",
    category: "blush",
    stampScore: 95,
    prices: [
      { retailer: "Sephora", price: 23.0, url: "#", inStock: true },
      { retailer: "RareBeauty.com", price: 23.0, url: "#", inStock: true },
    ],
    description: "A weightless, long-lasting liquid blush with a soft, healthy flush.",
    filters: { formula: "Liquid", finish: "Matte" },
  },
  // Bronzer
  {
    id: "11",
    name: "Hoola Matte Bronzer",
    brand: "Benefit",
    image: "/placeholder-product.jpg",
    category: "bronzer",
    stampScore: 86,
    prices: [
      { retailer: "Sephora", price: 30.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 30.0, url: "#", inStock: true },
    ],
    description: "A matte bronzing powder for a natural sun-kissed glow.",
    filters: { formula: "Powder", shimmer: "No" },
  },
  {
    id: "12",
    name: "Butter Bronzer",
    brand: "Physician's Formula",
    image: "/placeholder-product.jpg",
    category: "bronzer",
    stampScore: 83,
    prices: [
      { retailer: "Ulta Beauty", price: 16.49, url: "#", inStock: true },
      { retailer: "Amazon", price: 12.99, url: "#", inStock: true },
    ],
    description: "A creamy, Brazilian butter-infused bronzer with a radiant glow.",
    filters: { formula: "Powder", shimmer: "Yes" },
  },
  // Highlighter
  {
    id: "13",
    name: "Killawatt Highlighter",
    brand: "Fenty Beauty",
    image: "/placeholder-product.jpg",
    category: "highlighter",
    stampScore: 92,
    prices: [
      { retailer: "Sephora", price: 38.0, url: "#", inStock: true },
      { retailer: "FentyBeauty.com", price: 38.0, url: "#", inStock: true },
    ],
    description: "A weightless, longwear cream-powder hybrid highlighter.",
    filters: { formula: "Powder", intensity: "Blinding" },
  },
  {
    id: "14",
    name: "Backstage Glow Face Palette",
    brand: "Dior",
    image: "/placeholder-product.jpg",
    category: "highlighter",
    stampScore: 89,
    prices: [
      { retailer: "Sephora", price: 45.0, url: "#", inStock: true },
      { retailer: "Dior.com", price: 45.0, url: "#", inStock: true },
    ],
    description: "A multi-use highlighting palette with buildable, blendable shades.",
    filters: { formula: "Powder", intensity: "Subtle" },
  },
  // Contour
  {
    id: "15",
    name: "Match Stix Contour Skinstick",
    brand: "Fenty Beauty",
    image: "/placeholder-product.jpg",
    category: "contour",
    stampScore: 87,
    prices: [
      { retailer: "Sephora", price: 28.0, url: "#", inStock: true },
      { retailer: "FentyBeauty.com", price: 28.0, url: "#", inStock: true },
    ],
    description: "A creamy, blendable contour stick for precise sculpting.",
    filters: { formula: "Stick" },
  },
  {
    id: "16",
    name: "Sculpt Contour Powder",
    brand: "NYX",
    image: "/placeholder-product.jpg",
    category: "contour",
    stampScore: 79,
    prices: [
      { retailer: "Ulta Beauty", price: 10.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 8.49, url: "#", inStock: true },
    ],
    description: "A lightweight pressed powder for easy, natural-looking contour.",
    filters: { formula: "Powder" },
  },
  // Eyeshadow
  {
    id: "17",
    name: "Soft Matte Eyeshadow Palette",
    brand: "Urban Decay",
    image: "/placeholder-product.jpg",
    category: "eyeshadow",
    stampScore: 92,
    prices: [
      { retailer: "Sephora", price: 54.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 52.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 48.99, url: "#", inStock: true },
    ],
    description: "A versatile palette with 12 highly pigmented shades.",
    specs: ["12 shades", "Matte & shimmer finishes", "Vegan formula"],
    filters: { finish: "Matte", paletteSize: "12+", colorFamily: "Neutral" },
  },
  {
    id: "18",
    name: "Modern Renaissance Palette",
    brand: "Anastasia Beverly Hills",
    image: "/placeholder-product.jpg",
    category: "eyeshadow",
    stampScore: 96,
    prices: [
      { retailer: "Sephora", price: 45.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 45.0, url: "#", inStock: true },
    ],
    description: "An iconic palette featuring 14 shades in warm berry and neutral tones.",
    filters: { finish: "Shimmer", paletteSize: "12+", colorFamily: "Warm" },
  },
  // Eyeliner
  {
    id: "19",
    name: "Stay All Day Waterproof Liner",
    brand: "Stila",
    image: "/placeholder-product.jpg",
    category: "eyeliner",
    stampScore: 90,
    prices: [
      { retailer: "Sephora", price: 23.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 23.0, url: "#", inStock: true },
    ],
    description: "A felt-tip liquid liner for precise, smudge-proof lines.",
    filters: { type: "Felt-tip", waterproof: "Yes" },
  },
  {
    id: "20",
    name: "Epic Ink Liner",
    brand: "NYX",
    image: "/placeholder-product.jpg",
    category: "eyeliner",
    stampScore: 85,
    prices: [
      { retailer: "Ulta Beauty", price: 9.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 7.49, url: "#", inStock: true },
    ],
    description: "A waterproof liquid liner with a flexible brush tip.",
    filters: { type: "Liquid", waterproof: "Yes" },
  },
  // Mascara
  {
    id: "21",
    name: "Lash Sensational Mascara",
    brand: "Maybelline",
    image: "/placeholder-product.jpg",
    category: "mascara",
    stampScore: 80,
    prices: [
      { retailer: "Ulta Beauty", price: 9.99, url: "#", inStock: true },
      { retailer: "Amazon", price: 7.98, url: "#", inStock: true },
    ],
    description: "A fan-effect mascara for volume, length, and a full-fan effect.",
    filters: { effect: "Volume", waterproof: "No" },
  },
  {
    id: "22",
    name: "Better Than Sex Mascara",
    brand: "Too Faced",
    image: "/placeholder-product.jpg",
    category: "mascara",
    stampScore: 89,
    prices: [
      { retailer: "Sephora", price: 29.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 29.0, url: "#", inStock: true },
    ],
    description: "A volumizing mascara for dramatic, full lashes.",
    filters: { effect: "Volume", waterproof: "No" },
  },
  // False Lashes
  {
    id: "23",
    name: "Demi Wispies",
    brand: "Ardell",
    image: "/placeholder-product.jpg",
    category: "false-lashes",
    stampScore: 84,
    prices: [
      { retailer: "Ulta Beauty", price: 4.99, url: "#", inStock: true },
      { retailer: "Amazon", price: 3.49, url: "#", inStock: true },
    ],
    description: "A natural-looking, wispy false lash for everyday wear.",
    filters: { style: "Wispy", material: "Synthetic" },
  },
  {
    id: "24",
    name: "Miami Lashes",
    brand: "Lilly Lashes",
    image: "/placeholder-product.jpg",
    category: "false-lashes",
    stampScore: 91,
    prices: [
      { retailer: "Sephora", price: 30.0, url: "#", inStock: true },
      { retailer: "LillyLashes.com", price: 30.0, url: "#", inStock: true },
    ],
    description: "A dramatic 3D mink lash for bold, glamorous looks.",
    filters: { style: "Dramatic", material: "Mink" },
  },
  // Brow Pencil
  {
    id: "25",
    name: "Brow Wiz",
    brand: "Anastasia Beverly Hills",
    image: "/placeholder-product.jpg",
    category: "brow-pencil",
    stampScore: 85,
    prices: [
      { retailer: "Sephora", price: 25.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 25.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 22.5, url: "#", inStock: true },
    ],
    description: "An ultra-slim, retractable pencil for precise, hair-like strokes.",
    specs: ["Ultra-fine tip", "Built-in spoolie", "12 shades"],
    filters: { tipType: "Ultra-fine", spoolie: "Yes" },
  },
  {
    id: "26",
    name: "Precisely, My Brow Pencil",
    brand: "Benefit",
    image: "/placeholder-product.jpg",
    category: "brow-pencil",
    stampScore: 87,
    prices: [
      { retailer: "Sephora", price: 26.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 26.0, url: "#", inStock: true },
    ],
    description: "An ultra-fine brow pencil for natural-looking, defined brows.",
    filters: { tipType: "Ultra-fine", spoolie: "Yes" },
  },
  // Brow Gel
  {
    id: "27",
    name: "Boy Brow",
    brand: "Glossier",
    image: "/placeholder-product.jpg",
    category: "brow-gel",
    stampScore: 86,
    prices: [
      { retailer: "Glossier.com", price: 17.0, url: "#", inStock: true },
      { retailer: "Sephora", price: 17.0, url: "#", inStock: true },
    ],
    description: "A conditioning brow gel that thickens and shapes brows.",
    filters: { tinted: "Yes", hold: "Light" },
  },
  {
    id: "28",
    name: "Gimme Brow+",
    brand: "Benefit",
    image: "/placeholder-product.jpg",
    category: "brow-gel",
    stampScore: 84,
    prices: [
      { retailer: "Sephora", price: 26.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 26.0, url: "#", inStock: true },
    ],
    description: "A tinted volumizing brow gel with micro-fibers.",
    filters: { tinted: "Yes", hold: "Strong" },
  },
  // Lipstick
  {
    id: "29",
    name: "Matte Lipstick",
    brand: "MAC",
    image: "/placeholder-product.jpg",
    category: "lipstick",
    stampScore: 90,
    prices: [
      { retailer: "MAC.com", price: 23.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 23.0, url: "#", inStock: true },
    ],
    description: "An iconic matte lipstick with rich, long-lasting color.",
    filters: { finish: "Matte", type: "Bullet", longWear: "Yes" },
  },
  {
    id: "30",
    name: "Pillow Talk Lipstick",
    brand: "Charlotte Tilbury",
    image: "/placeholder-product.jpg",
    category: "lipstick",
    stampScore: 93,
    prices: [
      { retailer: "Sephora", price: 35.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 35.0, url: "#", inStock: true },
    ],
    description: "A dreamy nude-pink lipstick with a satin, kissable finish.",
    filters: { finish: "Satin", type: "Bullet", longWear: "No" },
  },
  // Lip Gloss
  {
    id: "31",
    name: "Lip Glow Oil",
    brand: "Dior",
    image: "/placeholder-product.jpg",
    category: "lip-gloss",
    stampScore: 97,
    prices: [
      { retailer: "Sephora", price: 40.0, url: "#", inStock: true },
      { retailer: "Dior.com", price: 40.0, url: "#", inStock: true },
    ],
    description: "A nourishing lip oil that enhances natural lip color with a glossy finish.",
    filters: { finish: "Clear", tinted: "Yes", plumping: "No" },
  },
  {
    id: "32",
    name: "Gloss Bomb",
    brand: "Fenty Beauty",
    image: "/placeholder-product.jpg",
    category: "lip-gloss",
    stampScore: 91,
    prices: [
      { retailer: "Sephora", price: 21.0, url: "#", inStock: true },
      { retailer: "FentyBeauty.com", price: 21.0, url: "#", inStock: true },
    ],
    description: "A universally flattering lip luminizer with explosive shine.",
    filters: { finish: "Shimmer", tinted: "Yes", plumping: "No" },
  },
  // Lip Liner
  {
    id: "33",
    name: "Lip Cheat Liner",
    brand: "Charlotte Tilbury",
    image: "/placeholder-product.jpg",
    category: "lip-liner",
    stampScore: 89,
    prices: [
      { retailer: "Sephora", price: 25.0, url: "#", inStock: true },
      { retailer: "Nordstrom", price: 25.0, url: "#", inStock: true },
    ],
    description: "A smooth lip liner that defines, reshapes, and perfects lips.",
    filters: { finish: "Matte", retractable: "Yes" },
  },
  {
    id: "34",
    name: "Suede Matte Lip Liner",
    brand: "NYX",
    image: "/placeholder-product.jpg",
    category: "lip-liner",
    stampScore: 81,
    prices: [
      { retailer: "Ulta Beauty", price: 5.0, url: "#", inStock: true },
      { retailer: "Amazon", price: 4.49, url: "#", inStock: true },
    ],
    description: "A creamy, matte lip liner with rich pigmentation.",
    filters: { finish: "Matte", retractable: "No" },
  },
  // Setting Spray
  {
    id: "35",
    name: "All Nighter Setting Spray",
    brand: "Urban Decay",
    image: "/placeholder-product.jpg",
    category: "setting-spray",
    stampScore: 92,
    prices: [
      { retailer: "Sephora", price: 36.0, url: "#", inStock: true },
      { retailer: "Ulta Beauty", price: 36.0, url: "#", inStock: true },
    ],
    description: "A long-lasting setting spray that keeps makeup in place for up to 16 hours.",
    filters: { finish: "Natural", longWear: "Yes" },
  },
  {
    id: "36",
    name: "Matte Finish Setting Spray",
    brand: "NYX",
    image: "/placeholder-product.jpg",
    category: "setting-spray",
    stampScore: 80,
    prices: [
      { retailer: "Ulta Beauty", price: 9.5, url: "#", inStock: true },
      { retailer: "Amazon", price: 7.99, url: "#", inStock: true },
    ],
    description: "A lightweight matte setting spray that controls shine all day.",
    filters: { finish: "Matte", longWear: "Yes" },
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
    products: [sampleProducts[8], sampleProducts[30], sampleProducts[0]],
  },
  {
    id: "2",
    name: "Soft Glam",
    image: "/placeholder-trend.jpg",
    stampScore: 89,
    description:
      "Warm-toned eyeshadows, defined brows, and nude lips for an elevated everyday look.",
    direction: "stable",
    products: [sampleProducts[16], sampleProducts[24], sampleProducts[30]],
  },
  {
    id: "3",
    name: "Glass Skin",
    image: "/placeholder-trend.jpg",
    stampScore: 91,
    description:
      "Ultra-dewy, translucent skin that looks like glass — achieved with hydrating primers and luminous foundations.",
    direction: "rising",
    products: [sampleProducts[0], sampleProducts[8]],
  },
];
