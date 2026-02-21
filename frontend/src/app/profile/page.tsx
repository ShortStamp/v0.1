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
<<<<<<< Updated upstream
  const [beautyProfile, setBeautyProfile] = useState<BeautyProfile | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("beautyProfile");
    if (saved) {
      setBeautyProfile(JSON.parse(saved));
    }
  }, []);
=======
  const [beautyProfile, setBeautyProfile] = useState<BeautyProfile | null>(() => {
    if (typeof window === "undefined") return null;
    const local = localStorage.getItem("beautyProfile");
    return local ? JSON.parse(local) : null;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load remote data if authenticated
    if (isAuthenticated) {
      (async () => {
        try {
          const [profile, styles, notif] = await Promise.allSettled([
            api.getProfile(),
            api.getStyles(),
            api.getNotifications(),
          ]);
          if (profile.status === "fulfilled" && profile.value.skinTone) {
            setBeautyProfile(profile.value);
            localStorage.setItem("beautyProfile", JSON.stringify(profile.value));
          }
          if (styles.status === "fulfilled") {
            setSelectedStyles(styles.value);
          }
          if (notif.status === "fulfilled") {
            setNotifications(notif.value);
          }
        } catch {}
      })();
    }
  }, [isAuthenticated]);

  const handleSave = useCallback(async () => {
    if (!isAuthenticated) return;
    setSaving(true);
    setSaved(false);
    try {
      const promises: Promise<void>[] = [];
      if (beautyProfile) {
        promises.push(api.saveProfile(beautyProfile));
      }
      promises.push(api.saveStyles(selectedStyles));
      promises.push(api.saveNotifications(notifications));
      await Promise.all(promises);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }, [isAuthenticated, beautyProfile, selectedStyles, notifications]);
>>>>>>> Stashed changes

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const formatLabel = (key: string, value: string) => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12">
        <div className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent font-sans">Account Dashboard</p>
        </div>
        <h1 className="text-4xl font-bold font-serif leading-tight">Your Profile</h1>
      </div>

      {/* Beauty Profile */}
      {beautyProfile ? (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Beauty Profile</h2>
            <Link
              href="/quiz"
<<<<<<< Updated upstream
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-accent"
=======
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent hover:text-pink-deep transition-colors font-sans"
>>>>>>> Stashed changes
            >
              <Edit className="h-3.5 w-3.5" />
              Retake Quiz
            </Link>
          </div>
<<<<<<< Updated upstream
          <div className="rounded-2xl border border-border bg-muted p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Skin Tone
=======
          <div className="rounded-3xl border border-border/50 bg-white p-8 shadow-xl shadow-accent/5">
            <div className="grid gap-8 sm:grid-cols-2">
              {[
                { label: "Skin Tone", value: beautyProfile.skinTone },
                { label: "Undertone", value: beautyProfile.undertone },
                { label: "Skin Type", value: beautyProfile.skinType },
                { label: "Coverage", value: beautyProfile.coverage },
                { label: "Finish", value: beautyProfile.finish },
                { label: "Budget", value: beautyProfile.budget },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">
                    {item.label}
                  </div>
                  <div className="text-base font-semibold font-serif text-foreground">
                    {formatLabel(item.label, item.value)}
                  </div>
>>>>>>> Stashed changes
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
<<<<<<< Updated upstream
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Beauty Profile</h2>
          <div className="rounded-2xl border border-border bg-muted p-6 text-center">
            <p className="mb-4 text-sm text-foreground/60">
              Complete the quiz to get personalized product recommendations.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white shadow-md shadow-accent/20 transition-all hover:shadow-lg hover:shadow-accent/25 hover:brightness-110"
=======
        <section className="mb-12">
          <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Beauty Profile</h2>
          <div className="rounded-3xl border border-dashed border-border/50 bg-white p-12 text-center shadow-xl shadow-accent/5">
            <p className="mb-8 text-sm text-foreground/60 font-sans leading-relaxed">
              Complete the beauty quiz to unlock personalized product recommendations and real-time compatibility checks.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-3 bg-accent px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white rounded-full shadow-xl shadow-accent/20 transition-all hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-0.5 font-sans"
>>>>>>> Stashed changes
            >
              Take the Quiz
            </Link>
          </div>
        </section>
      )}

      {/* Face upload */}
<<<<<<< Updated upstream
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
=======
      <section className="mb-12">
        <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Face Analysis</h2>
        <div className="group relative flex h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border/50 bg-white transition-all hover:border-accent hover:bg-accent/5 hover:shadow-xl hover:shadow-accent/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-foreground/20 transition-colors group-hover:bg-accent group-hover:text-white">
            <Upload className="h-8 w-8" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold uppercase tracking-widest text-foreground font-sans">
                Upload Portrait
            </p>
            <p className="text-xs text-foreground/40 font-sans">PNG, JPG up to 5MB</p>
          </div>
>>>>>>> Stashed changes
        </div>
      </section>

      {/* Style preferences */}
<<<<<<< Updated upstream
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
=======
      <section className="mb-12">
        <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Aesthetic Interest</h2>
        <div className="flex flex-wrap gap-3">
          {styleOptions.map((style) => {
            const active = selectedStyles.includes(style);
            return (
                <button
                key={style}
                onClick={() => toggleStyle(style)}
                className={`rounded-full px-6 py-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 font-sans ${
                    active
                    ? "bg-accent text-white shadow-lg shadow-accent/20 border-accent"
                    : "bg-white text-foreground/40 hover:bg-muted hover:text-foreground border border-border/50"
                }`}
                >
                {style}
                </button>
            );
          })}
>>>>>>> Stashed changes
        </div>
      </section>

      {/* Notifications */}
      <section className="mb-12">
        <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Notifications</h2>
        <button
          onClick={() => setNotifications(!notifications)}
<<<<<<< Updated upstream
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
=======
          className={`flex w-full items-center gap-6 rounded-3xl border px-8 py-6 transition-all duration-300 ${
            notifications
              ? "border-accent bg-accent/5 shadow-xl shadow-accent/5"
              : "border-border/50 bg-white hover:border-accent shadow-sm"
          }`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${notifications ? "bg-accent text-white" : "bg-muted text-foreground/20"}`}>
            {notifications ? (
                <Bell className="h-6 w-6" />
            ) : (
                <BellOff className="h-6 w-6" />
            )}
          </div>
>>>>>>> Stashed changes
          <div className="text-left">
            <p className={`text-sm font-bold uppercase tracking-widest font-sans ${notifications ? "text-accent" : "text-foreground"}`}>
              {notifications ? "Real-time alerts enabled" : "Enable alerts"}
            </p>
            <p className="text-xs text-foreground/40 font-sans mt-1">
              Receive trending aesthetic drops and price drop alerts.
            </p>
          </div>
        </button>
      </section>
<<<<<<< Updated upstream
=======

      {/* Save button (authenticated users) */}
      {isAuthenticated && (
        <div className="mt-16 border-t border-border/30 pt-10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-foreground px-8 py-5 text-[11px] font-bold uppercase tracking-[0.3em] text-white shadow-2xl shadow-black/20 transition-all duration-300 hover:bg-accent hover:shadow-accent/30 disabled:opacity-50 font-sans"
          >
            {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {saving ? "SYNCHRONIZING..." : saved ? "CHANGES PERSISTED" : "SAVE PREFERENCES"}
          </button>
        </div>
      )}
>>>>>>> Stashed changes
    </div>
  );
}
