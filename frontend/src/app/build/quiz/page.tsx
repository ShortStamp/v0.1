"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BeautyProfile } from "@/types";
import { quizQuestions } from "@/lib/quiz";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
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

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: google.accounts.id.client.Config) => void;
          prompt: (callback?: (notification: google.accounts.id.CredentialResponse) => void) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: AppleID.auth.ClientConfig) => void;
        signIn: () => Promise<AppleID.Authorization>;
      };
    };
  }
}

export default function QuizPage() {
  const router = useRouter();
  const { login, signup, loginWithGoogle, loginWithApple, isAuthenticated, isLoading: authLoading_ } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<BeautyProfile>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  // Auth prompt state
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const total = quizQuestions.length;
  const question = quizQuestions[step];

  // Wait for auth to finish loading, then decide what to show
  useEffect(() => {
    if (authLoading_) return;

    if (isAuthenticated) {
      // Already logged in — go straight to build
      router.replace("/build");
      return;
    }

    // Not authenticated — check if quiz was already taken
    const existing = localStorage.getItem("beautyProfile");
    if (existing) {
      // Quiz done, show auth prompt
      setDone(true);
    }
    // Show the page
    setReady(true);
  }, [authLoading_, isAuthenticated, router]);

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

  // Load Google Identity Services SDK
  useEffect(() => {
    if (!done) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
      });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // Load Apple Sign In SDK
  useEffect(() => {
    if (!done) return;
    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement("script");
    script.src =
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => {
      window.AppleID?.auth.init({
        clientId,
        scope: "name email",
        redirectURI: window.location.origin + "/build/quiz",
        usePopup: true,
      });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [done]);

  async function syncProfileToAPI() {
    try {
      const raw = localStorage.getItem("beautyProfile");
      if (!raw) return;
      const profile = JSON.parse(raw) as BeautyProfile;
      await api.saveProfile(profile);
    } catch {}
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function handleGoogleResponse(response: google.accounts.id.CredentialResponse) {
    setAuthLoading(true);
    setAuthError("");
    try {
      await loginWithGoogle(response.credential);
      await syncProfileToAPI();
      router.push("/build");
    } catch (err: unknown) {
      setAuthError((err as Error).message || "Google sign-in failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleClick() {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      setAuthError("Google SDK not loaded. Check your client ID.");
    }
  }

  async function handleAppleClick() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await window.AppleID?.auth.signIn();
      if (response?.authorization?.id_token) {
        await loginWithApple(
          response.authorization.id_token,
          response.user || undefined
        );
        await syncProfileToAPI();
        router.push("/build");
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any).error !== "popup_closed_by_user") {
        setAuthError((err as Error).message || "Apple sign-in failed");
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      if (authMode === "signup") {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      await syncProfileToAPI();
      router.push("/build");
    } catch (err: unknown) {
      setAuthError((err as Error).message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleSkip() {
    const hasProfile = localStorage.getItem("beautyProfile");
    if (hasProfile) {
      router.push("/build");
    } else {
      // No quiz taken yet — start the quiz
      setDone(false);
    }
  }

  // Show nothing while auth state is loading to prevent flash
  if (!ready) {
    return <div className="fixed inset-0 z-40 bg-background" />;
  }

  // --- Auth Prompt screen ---
  if (done) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--pink-soft),transparent_50%),radial-gradient(circle_at_bottom_left,var(--muted),transparent_50%)] opacity-70" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm animate-pop-in">
          {/* Check icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-accent">
            <Check className="h-8 w-8" />
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-center text-xl font-bold uppercase tracking-[0.15em] font-serif">
            Save Your Results
          </h1>
          <p className="mb-8 text-center text-xs tracking-wide text-foreground/40 font-sans">
            Create an account to save your beauty profile and builds.
          </p>

          {/* OAuth buttons */}
          <button
            onClick={handleGoogleClick}
            disabled={authLoading}
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-border/50 bg-white px-4 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/5 disabled:opacity-50 font-sans"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <button
            onClick={handleAppleClick}
            disabled={authLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-border/50 bg-white px-4 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-foreground transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/5 disabled:opacity-50 font-sans"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.28c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.3 4.12zM12.03 9.2C11.88 6.88 13.76 5 15.96 4.82c.3 2.67-2.42 4.65-3.93 4.38z" />
            </svg>
            Sign in with Apple
          </button>

          {/* Divider */}
          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 font-sans">or</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleEmailSubmit} className="mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mb-3 w-full rounded-2xl border border-border/50 bg-white px-5 py-3.5 text-xs tracking-wide text-foreground placeholder-foreground/30 outline-none transition-all focus:border-accent focus:shadow-lg focus:shadow-accent/5 font-sans"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mb-4 w-full rounded-2xl border border-border/50 bg-white px-5 py-3.5 text-xs tracking-wide text-foreground placeholder-foreground/30 outline-none transition-all focus:border-accent focus:shadow-lg focus:shadow-accent/5 font-sans"
            />
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-2xl bg-accent px-4 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-accent/20 transition-all hover:bg-pink-deep hover:shadow-pink-deep/30 hover:-translate-y-0.5 disabled:opacity-50 font-sans"
            >
              {authMode === "signup" ? "CREATE ACCOUNT" : "LOG IN"}
            </button>
          </form>

          {authError && (
            <p className="mb-4 text-center text-xs text-red-500 font-sans">{authError}</p>
          )}

          {/* Toggle signup/login */}
          <p className="mb-6 text-center text-xs text-foreground/40 font-sans">
            {authMode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className="font-bold uppercase tracking-wider text-accent transition-colors hover:text-pink-deep"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className="font-bold uppercase tracking-wider text-accent transition-colors hover:text-pink-deep"
                >
                  Sign up
                </button>
              </>
            )}
          </p>

          {/* Skip */}
          <button
            onClick={handleSkip}
            className="w-full py-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 transition-colors hover:text-accent font-sans"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // --- Quiz question screen ---
  const gridCols = "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      {/* Progress bar */}
      <div className="h-1.5 w-full shrink-0 overflow-hidden bg-muted">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>

      {/* Back + step counter */}
      <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-6 py-4">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/40 transition-colors hover:text-accent font-sans"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/30 font-sans">
          {step + 1} of {total}
        </span>
      </div>

      {/* Centered content */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        {/* Question */}
        <h1 className="mb-2 max-w-xl shrink-0 text-center text-2xl font-bold leading-snug font-serif sm:text-3xl">
          {question.title}
        </h1>
        <p className="mb-8 max-w-md shrink-0 text-center text-sm text-foreground/40 font-sans">
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
                    ? "border-accent bg-accent text-white shadow-lg shadow-accent/20"
                    : wasPreviouslyChosen
                      ? "border-accent bg-accent/5"
                      : "border-border/50 bg-white hover:border-accent hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5"
                }`}
              >
                {/* Icon */}
                <Icon
                  className={`h-6 w-6 transition-colors duration-200 ${
                    isSelected
                      ? "text-white"
                      : wasPreviouslyChosen
                        ? "text-accent"
                        : "text-accent/30 group-hover:text-accent"
                  }`}
                />

                {/* Label */}
                <span
                  className={`text-sm font-bold uppercase tracking-wide transition-colors duration-200 font-sans ${
                    isSelected
                      ? "text-white"
                      : "text-foreground"
                  }`}
                >
                  {opt.label}
                </span>

                {/* Description */}
                <span
                  className={`text-xs leading-snug transition-colors duration-200 font-sans ${
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
