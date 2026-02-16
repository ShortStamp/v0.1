"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BeautyProfile } from "@/types";
import { quizQuestions } from "@/lib/quiz";
import {
  Cloud,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Star,
  Snowflake,
  Flame,
  Circle,
  Droplets,
  Wind,
  Contrast,
  Smile,
  Feather,
  Layers,
  Shield,
  Paintbrush,
  Sparkles,
  Square,
  Gem,
  PiggyBank,
  Wallet,
  Crown,
  Shuffle,
  ArrowLeft,
  Check,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  cloud: Cloud,
  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  moon: Moon,
  star: Star,
  snowflake: Snowflake,
  flame: Flame,
  circle: Circle,
  droplets: Droplets,
  wind: Wind,
  contrast: Contrast,
  smile: Smile,
  feather: Feather,
  layers: Layers,
  shield: Shield,
  paintbrush: Paintbrush,
  sparkles: Sparkles,
  square: Square,
  gem: Gem,
  piggyBank: PiggyBank,
  wallet: Wallet,
  crown: Crown,
  shuffle: Shuffle,
};

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<BeautyProfile>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = quizQuestions.length;
  const question = quizQuestions[step];

  const advance = useCallback(
    (value: string) => {
      const key = question.key;
      const updated = { ...answers, [key]: value };
      setAnswers(updated);
      setSelected(value);

      setTimeout(() => {
        setSelected(null);
        if (step + 1 < total) {
          setStep(step + 1);
        } else {
          localStorage.setItem("beautyProfile", JSON.stringify(updated));
          setDone(true);
        }
      }, 300);
    },
    [answers, question, step, total]
  );

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setSelected(null);
    }
  };

  // --- Completion screen ---
  if (done) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br from-accent via-secondary to-accent px-4 text-center text-white">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm">
          <Check className="h-12 w-12" />
        </div>
        <h1 className="mb-3 text-3xl font-bold uppercase tracking-tight">
          You&apos;re All Set
        </h1>
        <p className="mb-12 max-w-md text-sm text-white/70">
          Your beauty profile has been saved. We&apos;ll use it to help you find the
          perfect products.
        </p>
        <button
          onClick={() => router.push("/build")}
          className="rounded-full bg-white px-12 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-accent shadow-lg transition-all hover:shadow-xl hover:brightness-95"
        >
          Start Building
        </button>
      </div>
    );
  }

  // --- Quiz question screen ---
  const optCount = question.options.length;
  const gridCols =
    optCount <= 3
      ? "grid-cols-1 sm:grid-cols-3"
      : optCount === 4
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      {/* Progress bar */}
      <div className="h-1 w-full shrink-0 rounded-full bg-muted">
        <div
          className="h-1 rounded-full bg-gradient-to-r from-accent to-secondary transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>

      {/* Back + step counter */}
      <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-6 py-4">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-foreground/40 transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-foreground/30">
          {step + 1} of {total}
        </span>
      </div>

      {/* Centered content */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        {/* Question */}
        <h1 className="mb-2 max-w-xl shrink-0 text-center text-2xl font-bold leading-snug sm:text-3xl">
          {question.title}
        </h1>
        <p className="mb-8 max-w-md shrink-0 text-center text-sm text-foreground/40">
          {question.subtitle}
        </p>

        {/* Answer cards */}
        <div className={`grid w-full max-w-3xl gap-3 ${gridCols}`}>
          {question.options.map((opt) => {
            const Icon = iconMap[opt.icon] ?? Circle;
            const isSelected = selected === opt.value;
            const previousAnswer = answers[question.key];
            const wasPreviouslyChosen =
              previousAnswer === opt.value && selected === null;

            return (
              <button
                key={opt.value}
                onClick={() => advance(opt.value)}
                disabled={selected !== null}
                className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-5 text-center transition-all duration-200 ${
                  isSelected
                    ? "border-accent bg-gradient-to-br from-accent to-secondary text-white shadow-lg shadow-accent/20"
                    : wasPreviouslyChosen
                      ? "border-accent bg-accent/5"
                      : "border-border bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10"
                }`}
              >
                {/* Icon */}
                <Icon
                  className={`h-6 w-6 transition-colors duration-200 ${
                    isSelected
                      ? "text-white"
                      : wasPreviouslyChosen
                        ? "text-pink-500"
                        : "text-pink-200 group-hover:text-pink-500"
                  }`}
                />

                {/* Label */}
                <span
                  className={`text-sm font-bold uppercase tracking-wide transition-colors duration-200 ${
                    isSelected
                      ? "text-white"
                      : "text-foreground"
                  }`}
                >
                  {opt.label}
                </span>

                {/* Description */}
                <span
                  className={`text-xs leading-snug transition-colors duration-200 ${
                    isSelected ? "text-white/70" : "text-foreground/40"
                  }`}
                >
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
