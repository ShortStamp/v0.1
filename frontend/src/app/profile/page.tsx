"use client";

import { Upload, Bell, BellOff } from "lucide-react";
import { useState } from "react";

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
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(false);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Your Profile</h1>

      {/* Face upload */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Face Photo</h2>
        <p className="mb-4 text-sm text-foreground/60">
          Upload a photo to get trend recommendations matched to your face shape
          and features.
        </p>
        <div className="flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border transition-colors hover:border-accent hover:bg-accent/5">
          <Upload className="h-8 w-8 text-foreground/30" />
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
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                selectedStyles.includes(style)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-foreground/60 hover:border-accent/50"
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
          className={`flex items-center gap-3 rounded-xl border px-5 py-4 transition-colors ${
            notifications
              ? "border-accent bg-accent/5"
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
