"use client";

import { useState } from "react";
import { quizQuestions } from "@/lib/quiz";
import { BeautyProfile } from "@/types";

interface QuizProps {
  onComplete: (profile: BeautyProfile) => void;
}

export default function Quiz({ onComplete }: QuizProps) {
  const total = quizQuestions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<BeautyProfile>>({});
  const [isAdvancing, setIsAdvancing] = useState(false);

  const question = quizQuestions[currentIndex];
  const progress = Math.round(((currentIndex + 1) / total) * 100);

  const handleSelect = (value: string) => {
    if (isAdvancing) return;
    const nextAnswers = { ...answers, [question.key]: value };
    setAnswers(nextAnswers);
    setIsAdvancing(true);

    window.setTimeout(() => {
      if (currentIndex === total - 1) {
        onComplete(nextAnswers as BeautyProfile);
        return;
      }
      setCurrentIndex((prev) => prev + 1);
      setIsAdvancing(false);
    }, 400);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
        <span>
          Step {currentIndex + 1} of {total}
        </span>
        <span>{progress}%</span>
      </div>

      <div className="mb-6 h-1 w-full bg-neutral-200">
        <div className="h-1 bg-black transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <h1 className="text-2xl font-bold uppercase tracking-[0.05em] sm:text-3xl">
        {question.title}
      </h1>
      <p className="mt-3 text-sm text-neutral-500">{question.subtitle}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {question.options.map((option) => {
          const selected = answers[question.key] === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`flex flex-col gap-2 border px-5 py-4 text-left transition-colors ${
                selected ? "border-black bg-black text-white" : "border-border hover:border-black"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">
                {option.label}
              </span>
              <span className="text-sm text-neutral-500">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
