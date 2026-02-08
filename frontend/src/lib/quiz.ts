import { BeautyProfile } from "@/types";

export interface QuizOption {
  label: string;
  value: string;
  icon: string; // lucide icon name used as key
  description: string;
}

export interface QuizQuestion {
  key: keyof BeautyProfile;
  title: string;
  subtitle: string;
  options: QuizOption[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    key: "skinTone",
    title: "What best describes your skin tone?",
    subtitle: "This helps us match foundation and concealer shades to you.",
    options: [
      { label: "Fair", value: "fair", icon: "cloud", description: "Very light, burns easily" },
      { label: "Light", value: "light", icon: "sun", description: "Light with some warmth" },
      { label: "Medium", value: "medium", icon: "sunrise", description: "Warm beige or olive" },
      { label: "Tan", value: "tan", icon: "sunset", description: "Golden or caramel tones" },
      { label: "Deep", value: "deep", icon: "moon", description: "Rich brown tones" },
      { label: "Rich", value: "rich", icon: "star", description: "Deepest and darkest tones" },
    ],
  },
  {
    key: "undertone",
    title: "Hold your wrist up to the light. What color are your veins?",
    subtitle: "Your undertone guides which shades will look most natural on you.",
    options: [
      { label: "Cool", value: "cool", icon: "snowflake", description: "Blue or purple veins — cool-toned" },
      { label: "Warm", value: "warm", icon: "flame", description: "Green veins — warm-toned" },
      { label: "Neutral", value: "neutral", icon: "circle", description: "A mix of both — lucky you" },
    ],
  },
  {
    key: "skinType",
    title: "How does your skin feel by midday?",
    subtitle: "We'll recommend formulas that work with your skin, not against it.",
    options: [
      { label: "Oily", value: "oily", icon: "droplets", description: "Shiny all over, pores visible" },
      { label: "Dry", value: "dry", icon: "wind", description: "Tight, flaky, or rough patches" },
      { label: "Combination", value: "combination", icon: "contrast", description: "Oily T-zone, dry cheeks" },
      { label: "Normal", value: "normal", icon: "smile", description: "Pretty balanced — no complaints" },
    ],
  },
  {
    key: "coverage",
    title: "How much coverage do you like?",
    subtitle: "From barely-there to full glam — there's no wrong answer.",
    options: [
      { label: "Sheer", value: "sheer", icon: "feather", description: "Barely there, just a tint" },
      { label: "Light", value: "light", icon: "layers", description: "Even things out, still see skin" },
      { label: "Medium", value: "medium", icon: "shield", description: "Smooth and polished" },
      { label: "Full", value: "full", icon: "paintbrush", description: "Flawless, covers everything" },
    ],
  },
  {
    key: "finish",
    title: "What finish do you reach for?",
    subtitle: "The vibe of your base — glowy, matte, or somewhere in between.",
    options: [
      { label: "Dewy", value: "dewy", icon: "sparkles", description: "Glowy, lit-from-within shine" },
      { label: "Matte", value: "matte", icon: "square", description: "Smooth, shine-free, velvety" },
      { label: "Satin", value: "satin", icon: "gem", description: "Natural — not too shiny, not flat" },
    ],
  },
  {
    key: "budget",
    title: "What's your typical budget per product?",
    subtitle: "Great makeup exists at every price point. We'll find it.",
    options: [
      { label: "Drugstore", value: "drugstore", icon: "piggyBank", description: "Under $15 — smart and savvy" },
      { label: "Mid-range", value: "midrange", icon: "wallet", description: "$15 – $35 — the sweet spot" },
      { label: "High-end", value: "highend", icon: "crown", description: "$35+ — treat yourself" },
      { label: "Mix", value: "mix", icon: "shuffle", description: "A little of everything" },
    ],
  },
];
