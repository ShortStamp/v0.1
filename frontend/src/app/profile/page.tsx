"use client";

import { Upload, Bell, BellOff, Edit, Save, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { BeautyProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
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
  const { isAuthenticated } = useAuth();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(false);
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

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const formatLabel = (key: string, value: string) => {
    if (!value) return "Not Set";
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
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent hover:text-pink-deep transition-colors font-sans"
            >
              <Edit className="h-3.5 w-3.5" />
              Retake Quiz
            </Link>
          </div>
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
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-12">
          <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Beauty Profile</h2>
          <div className="rounded-3xl border border-dashed border-border/50 bg-white p-12 text-center shadow-xl shadow-accent/5">
            <p className="mb-8 text-sm text-foreground/60 font-sans leading-relaxed">
              Complete the beauty quiz to unlock personalized product recommendations and real-time compatibility checks.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-3 bg-accent px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white rounded-full shadow-xl shadow-accent/20 transition-all hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-0.5 font-sans"
            >
              Take the Quiz
            </Link>
          </div>
        </section>
      )}

      {/* Face upload */}
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
        </div>
      </section>

      {/* Style preferences */}
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
        </div>
      </section>

      {/* Notifications */}
      <section className="mb-12">
        <h2 className="mb-6 text-lg font-bold uppercase tracking-widest text-foreground/30 font-sans">Notifications</h2>
        <button
          onClick={() => setNotifications(!notifications)}
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
    </div>
  );
}
