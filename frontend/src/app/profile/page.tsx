"use client";

import { Upload, Bell, BellOff, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BeautyProfile } from "@/types";
import Link from "next/link";

const styleOptions = [
  "Clean Girl",
  "Soft Glam",
  "Bold & Dramatic",
  "Glass Skin",
  "Y2K",
  "Natural / No Makeup",
  "Editorial",
  "Cottagecore",
];

export default function ProfilePage() {
  const router = useRouter();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(false);
  const [beautyProfile, setBeautyProfile] = useState<BeautyProfile | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("beautyProfile");
    if (saved) {
      setBeautyProfile(JSON.parse(saved));
    }
  }, []);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const formatLabel = (key: string, value: string) => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold uppercase tracking-tight">Your Profile</h1>

      {/* Beauty Profile */}
      {beautyProfile ? (
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Beauty Profile</h2>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-accent"
            >
              <Edit className="h-4 w-4" />
              Retake Quiz
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-muted p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Skin Tone
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("skinTone", beautyProfile.skinTone)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Undertone
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("undertone", beautyProfile.undertone)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Skin Type
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("skinType", beautyProfile.skinType)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Coverage
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("coverage", beautyProfile.coverage)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Finish
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("finish", beautyProfile.finish)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Budget
                </div>
                <div className="text-sm font-semibold">
                  {formatLabel("budget", beautyProfile.budget)}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Beauty Profile</h2>
          <div className="rounded-2xl border border-border bg-muted p-6 text-center">
            <p className="mb-4 text-sm text-foreground/60">
              Complete the quiz to get personalized product recommendations.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white shadow-md shadow-accent/20 transition-all hover:shadow-lg hover:shadow-accent/25 hover:brightness-110"
            >
              Take the Quiz
            </Link>
          </div>
        </section>
      )}

      {/* Face upload */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Face Photo</h2>
        <p className="mb-4 text-sm text-foreground/60">
          Upload a photo to get trend recommendations matched to your face shape
          and features.
        </p>
        <div className="flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border transition-colors hover:border-accent hover:bg-accent/5">
          <Upload className="h-8 w-8 text-pink-300" />
          <p className="text-sm font-medium text-foreground/50">
            Click to upload a photo
          </p>
          <p className="text-xs text-foreground/30">PNG, JPG up to 5MB</p>
        </div>
      </section>

      {/* Style preferences */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Style Preferences</h2>
        <p className="mb-4 text-sm text-foreground/60">
          Select the makeup styles you&apos;re most interested in.
        </p>
        <div className="flex flex-wrap gap-2">
          {styleOptions.map((style) => (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                selectedStyles.includes(style)
                  ? "border-accent bg-accent/10 text-accent shadow-sm"
                  : "border-border text-foreground/60 hover:border-accent/50 hover:text-accent"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Notifications</h2>
        <button
          onClick={() => setNotifications(!notifications)}
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 transition-all ${
            notifications
              ? "border-accent bg-accent/5 shadow-sm"
              : "border-border hover:border-accent/50"
          }`}
        >
          {notifications ? (
            <Bell className="h-5 w-5 text-accent" />
          ) : (
            <BellOff className="h-5 w-5 text-foreground/40" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium">
              {notifications ? "Notifications enabled" : "Enable notifications"}
            </p>
            <p className="text-xs text-foreground/50">
              Get alerts when new trends match your preferences.
            </p>
          </div>
        </button>
      </section>
    </div>
  );
}
