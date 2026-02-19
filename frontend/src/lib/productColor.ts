import { Product } from "@/types";

interface ProductColorInfo {
  label: string;
  hex: string;
}

const swatchByKeyword: Array<{ keyword: string; label: string; hex: string }> = [
  { keyword: "fair", label: "Fair", hex: "#f0d2bc" },
  { keyword: "light", label: "Light", hex: "#e3bc99" },
  { keyword: "medium", label: "Medium", hex: "#c89267" },
  { keyword: "tan", label: "Tan", hex: "#ac6e45" },
  { keyword: "deep", label: "Deep", hex: "#74442f" },
  { keyword: "rich", label: "Rich", hex: "#4f2f23" },
  { keyword: "warm", label: "Warm", hex: "#c78e57" },
  { keyword: "cool", label: "Cool", hex: "#b996ba" },
  { keyword: "neutral", label: "Neutral", hex: "#b89f83" },
  { keyword: "peach", label: "Peach", hex: "#eb9d78" },
  { keyword: "coral", label: "Coral", hex: "#e77f66" },
  { keyword: "pink", label: "Pink", hex: "#da7398" },
  { keyword: "rose", label: "Rose", hex: "#c4627f" },
  { keyword: "berry", label: "Berry", hex: "#8a3a5a" },
  { keyword: "red", label: "Red", hex: "#c22d39" },
  { keyword: "nude", label: "Nude", hex: "#b88668" },
  { keyword: "brown", label: "Brown", hex: "#7c4f3a" },
  { keyword: "bronze", label: "Bronze", hex: "#9d6a43" },
  { keyword: "gold", label: "Gold", hex: "#c8a457" },
];

function toTitleCase(value: string): string {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

export function getProductColorInfo(product: Product): ProductColorInfo {
  const filterStrings = Object.entries(product.filters || {})
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({ key: key.toLowerCase(), value: String(value).toLowerCase() }));

  const preferred = ["shade", "skinTone", "undertone", "colorFamily", "color", "tone"].map((k) =>
    k.toLowerCase()
  );

  const prioritized =
    filterStrings.find((entry) => preferred.some((key) => entry.key.includes(key))) ||
    filterStrings[0];

  if (!prioritized) {
    return { label: "Default", hex: "#d7b7bc" };
  }

  const rawLabel = toTitleCase(prioritized.value.split(",")[0].trim());
  const keywordMatch = swatchByKeyword.find(({ keyword }) => prioritized.value.includes(keyword));

  return {
    label: rawLabel || keywordMatch?.label || "Default",
    hex: keywordMatch?.hex || "#d7b7bc",
  };
}
