"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quizQuestions, QuizOption } from "@/lib/quiz";
import { BeautyProfile } from "@/types";
import { ChevronRight, ChevronLeft } from "lucide-react";
import * as LucideIcons from "lucide-react";

export default function QuizPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [profile, setProfile] = useState<Partial<BeautyProfile>>({});

  const handleSelect = (value: string) => {
    const question = quizQuestions[currentQuestion];
    const updatedProfile = { ...profile, [question.key]: value };
    setProfile(updatedProfile);

    // Auto-advance to next question
    setTimeout(() => {
      if (currentQuestion < quizQuestions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        // Quiz complete - save profile and redirect to build
        sessionStorage.setItem("beautyProfile", JSON.stringify(updatedProfile));
        router.push("/build");
      }
    }, 300);
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const question = quizQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar */}
      <div className="fixed left-0 right-0 top-16 h-1 bg-neutral-100">
        <div
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-24">
        {/* Question header */}
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            Question {currentQuestion + 1} of {quizQuestions.length}
          </div>
          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {question.title}
          </h1>
          <p className="text-base text-neutral-500">{question.subtitle}</p>
        </div>

        {/* Options grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {question.options.map((option: QuizOption) => {
            const IconComponent = (LucideIcons as any)[
              option.icon.charAt(0).toUpperCase() + option.icon.slice(1)
            ];
            const isSelected = profile[question.key] === option.value;

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`group relative flex flex-col items-start gap-3 border p-6 text-left transition-all hover:border-black ${
                  isSelected
                    ? "border-black bg-neutral-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center border transition-colors ${
                    isSelected
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 bg-white text-neutral-600 group-hover:border-black"
                  }`}
                >
                  {IconComponent && <IconComponent className="h-5 w-5" />}
                </div>
                <div>
                  <div className="mb-1 text-sm font-bold uppercase tracking-wide">
                    {option.label}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {option.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute right-4 top-4">
                    <div className="h-6 w-6 rounded-full bg-black flex items-center justify-center">
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="mt-12 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentQuestion === 0}
            className="inline-flex items-center gap-2 border border-neutral-300 px-6 py-3 text-xs font-medium uppercase tracking-[0.15em] text-neutral-600 transition-all hover:border-black hover:text-black disabled:opacity-30 disabled:hover:border-neutral-300 disabled:hover:text-neutral-600"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="text-xs text-neutral-400">
            {currentQuestion === quizQuestions.length - 1
              ? "Select to finish"
              : "Select to continue"}
          </div>

          <button
            disabled
            className="inline-flex items-center gap-2 border border-transparent px-6 py-3 text-xs font-medium uppercase tracking-[0.15em] text-transparent"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
