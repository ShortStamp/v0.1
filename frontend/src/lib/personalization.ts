import { BeautyProfile, CategoryDefinition } from "@/types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function findMatchingOption(options: string[] | undefined, candidates: string[]): string | null {
  if (!options || options.length === 0) return null;
  const optionMap = new Map(options.map((opt) => [normalize(opt), opt]));
  for (const candidate of candidates) {
    const match = optionMap.get(normalize(candidate));
    if (match) return match;
  }
  return null;
}

function getStoredBeautyProfile(): Partial<BeautyProfile> | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("beautyProfile");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<BeautyProfile>;
  } catch {
    return null;
  }
}

export function getQuizAutoFilters(
  category: CategoryDefinition,
  availableOptions: Record<string, string[]> = {}
): Record<string, Set<string>> {
  const profile = getStoredBeautyProfile();
  if (!profile) return {};

  const result: Record<string, Set<string>> = {};
  const getOptions = (key: string) => {
    // Prefer API-fetched options (reflects actual DB contents).
    // Fall back to static options only if the API hasn't returned any yet.
    const apiOpts = availableOptions[key];
    if (apiOpts && apiOpts.length > 0) return apiOpts;
    return category.filters.find((f) => f.key === key && f.type === "checkbox")?.options;
  };
  const addMatch = (key: string, candidates: string[]) => {
    const opts = getOptions(key);
    // Don't apply filter if the DB has no products with this filter value yet.
    if (!opts || opts.length === 0) return;
    const matched = findMatchingOption(opts, candidates);
    if (matched) result[key] = new Set([matched]);
  };

  if (profile.coverage) addMatch("coverage", [profile.coverage]);
  if (profile.finish) addMatch("finish", [profile.finish]);
  if (profile.skinType) addMatch("skinType", [profile.skinType]);

  if (category.key === "primer" && profile.skinType) {
    const primerTypeMap: Record<string, string[]> = {
      oily: ["Mattifying"],
      dry: ["Hydrating"],
      combination: ["Pore-Filling", "Hydrating"],
      normal: ["Hydrating"],
    };
    addMatch("type", primerTypeMap[normalize(profile.skinType)] || []);
  }

  if (category.key === "powder" && profile.finish) {
    const powderFinishMap: Record<string, string[]> = {
      matte: ["Matte"],
      dewy: ["Luminous"],
      satin: ["Luminous"],
    };
    addMatch("finish", powderFinishMap[normalize(profile.finish)] || [profile.finish]);
  }

  if (category.key === "setting-spray" && profile.finish) {
    const sprayFinishMap: Record<string, string[]> = {
      matte: ["Matte"],
      dewy: ["Dewy"],
      satin: ["Natural"],
    };
    addMatch("finish", sprayFinishMap[normalize(profile.finish)] || [profile.finish]);
  }

  return result;
}
