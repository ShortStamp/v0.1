import { useState, useEffect, useCallback } from "react";

// Type for the exposed Electron API
declare global {
  interface Window {
    shortstamp: {
      captureScreen: () => Promise<string>;
      analyze: (
        imageBase64: string,
        hint?: string
      ) => Promise<AnalysisResult>;
      login: (
        email: string,
        password: string
      ) => Promise<{ email: string; subscription_status: string }>;
      getAuthState: () => Promise<{ token: string; email: string } | null>;
      logout: () => Promise<boolean>;
      hide: () => void;
      close: () => void;
    };
  }
}

type Verdict = "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
type Category = "fact" | "link" | "media" | "general";
type AppState = "login" | "idle" | "capturing" | "analyzing" | "result" | "error";

interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  explanation: string;
  category: Category;
}

const VERDICT_STYLES: Record<Verdict, { label: string; bg: string; text: string; border: string }> = {
  REAL: { label: "REAL", bg: "bg-black", text: "text-white", border: "border-black" },
  FAKE: { label: "FAKE", bg: "bg-black", text: "text-white", border: "border-black" },
  SCAM: { label: "SCAM", bg: "bg-black", text: "text-white", border: "border-black" },
  AI_GENERATED: { label: "AI GEN", bg: "bg-black", text: "text-white", border: "border-black" },
  UNCERTAIN: { label: "UNCERTAIN", bg: "bg-white", text: "text-black", border: "border-black" },
};

const VERDICT_INDICATOR: Record<Verdict, string> = {
  REAL: "●",
  FAKE: "✕",
  SCAM: "⚠",
  AI_GENERATED: "◈",
  UNCERTAIN: "?",
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  // Check for existing auth on mount
  useEffect(() => {
    window.shortstamp.getAuthState().then((state) => {
      if (state) {
        setUserEmail(state.email);
        setAppState("idle");
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const data = await window.shortstamp.login(email, password);
      setUserEmail(data.email);

      if (data.subscription_status !== "active") {
        setLoginError(
          "No active subscription. Visit shortstamp.com to subscribe."
        );
        setLoginLoading(false);
        return;
      }

      setAppState("idle");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStamp = useCallback(async () => {
    setAppState("capturing");
    setResult(null);
    setErrorMessage(null);

    try {
      // Capture screen
      const imageBase64 = await window.shortstamp.captureScreen();
      setAppState("analyzing");

      // Analyze
      const analysisResult = await window.shortstamp.analyze(
        imageBase64,
        hint.trim() || undefined
      );
      setResult(analysisResult);
      setAppState("result");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Analysis failed");
      setAppState("error");
    }
  }, [hint]);

  const handleReset = () => {
    setResult(null);
    setErrorMessage(null);
    setHint("");
    setAppState("idle");
  };

  const handleLogout = async () => {
    await window.shortstamp.logout();
    setUserEmail(null);
    setEmail("");
    setPassword("");
    setAppState("login");
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border border-black shadow-2xl overflow-hidden font-sans">
      {/* Titlebar — draggable */}
      <div className="drag-region h-10 bg-black flex items-center justify-between px-4 shrink-0">
        <span className="text-white text-[10px] font-bold tracking-[0.2em] uppercase no-drag">
          ShortStamp
        </span>
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={() => window.shortstamp.hide()}
            className="text-gray-400 hover:text-white transition-colors duration-200 text-xs"
            title="Minimize"
          >
            —
          </button>
          <button
            onClick={() => window.shortstamp.close()}
            className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Login view */}
      {appState === "login" && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto scrollable">
          <div className="mb-8 mt-2">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-2">
              Sign in to continue
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Is it real?
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 flex-1">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1 text-gray-600">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="no-drag w-full border border-black px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-300"
                style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1 text-gray-600">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="no-drag w-full border border-black px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-300"
                style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
              />
            </div>

            {loginError && (
              <div className="border border-black bg-gray-50 px-3 py-2">
                <p className="text-[10px] text-black">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="no-drag w-full bg-black text-white py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-[9px] text-gray-400 text-center mt-4">
            No account?{" "}
            <span
              className="underline cursor-pointer hover:text-black transition-colors"
              onClick={() =>
                window.open
                  ? window.open("http://localhost:3000/subscribe")
                  : null
              }
            >
              Subscribe at shortstamp.com
            </span>
          </p>
        </div>
      )}

      {/* Idle view */}
      {appState === "idle" && (
        <div className="flex-1 flex flex-col p-6">
          {/* User info */}
          <div className="flex items-center justify-between mb-8">
            <p className="text-[9px] text-gray-400 tracking-wide truncate max-w-[200px]">
              {userEmail}
            </p>
            <button
              onClick={handleLogout}
              className="text-[9px] font-bold tracking-[0.1em] uppercase text-gray-400 hover:text-black transition-colors duration-200"
            >
              Sign out
            </button>
          </div>

          {/* Main stamp area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="text-center">
              <div className="border-[3px] border-black px-6 py-3 rotate-[-4deg] mb-4 inline-block">
                <span className="text-3xl font-black tracking-[0.15em] uppercase text-black">
                  STAMP IT
                </span>
              </div>
              <p className="text-[10px] text-gray-500 tracking-wide">
                Cmd+Shift+S to activate
              </p>
            </div>

            {/* Optional hint */}
            <div className="w-full">
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1 text-gray-500">
                Hint (optional)
              </label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="e.g. check this link for scams"
                className="no-drag w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-black transition-colors duration-200 placeholder-gray-300"
                style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
              />
            </div>

            <button
              onClick={handleStamp}
              className="no-drag w-full bg-black text-white py-4 text-sm font-black tracking-[0.2em] uppercase hover:bg-gray-800 active:bg-gray-900 transition-colors duration-200"
            >
              STAMP IT
            </button>
          </div>
        </div>
      )}

      {/* Capturing / Analyzing */}
      {(appState === "capturing" || appState === "analyzing") && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-bold tracking-[0.15em] uppercase">
              {appState === "capturing" ? "Capturing screen..." : "Analyzing..."}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              {appState === "capturing"
                ? "Taking screenshot"
                : "Asking the AI"}
            </p>
          </div>
        </div>
      )}

      {/* Result view */}
      {appState === "result" && result && (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto scrollable">
          {/* Verdict badge */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div
              className={`${VERDICT_STYLES[result.verdict].bg} ${VERDICT_STYLES[result.verdict].text} border-2 ${VERDICT_STYLES[result.verdict].border} px-8 py-4 w-full text-center`}
            >
              <div className="text-3xl font-black tracking-[0.15em] uppercase">
                {VERDICT_INDICATOR[result.verdict]} {VERDICT_STYLES[result.verdict].label}
              </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-gray-500">
                  Confidence
                </span>
                <span className="text-[9px] font-bold text-black">
                  {result.confidence}%
                </span>
              </div>
              <div className="w-full h-1 bg-gray-200">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${result.confidence}%` }}
                />
              </div>
            </div>

            {/* Category pill */}
            <div className="self-start">
              <span className="border border-gray-300 px-2 py-1 text-[9px] font-bold tracking-[0.15em] uppercase text-gray-500">
                {result.category}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div className="border border-gray-200 p-4 mb-6 flex-1 scrollable">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-2">
              Analysis
            </p>
            <p className="text-xs text-black leading-relaxed scrollable" style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}>
              {result.explanation}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="no-drag flex-1 bg-black text-white py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-gray-800 transition-colors duration-200"
            >
              Stamp Again
            </button>
            <button
              onClick={() => window.shortstamp.hide()}
              className="no-drag border border-black px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-gray-50 transition-colors duration-200"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* Error view */}
      {appState === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="border-2 border-black px-6 py-4 w-full">
            <p className="text-2xl font-black tracking-widest mb-1">ERROR</p>
            <p className="text-[10px] text-gray-600 scrollable" style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}>
              {errorMessage}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="no-drag w-full bg-black text-white py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-gray-800 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="h-7 bg-gray-50 border-t border-gray-100 flex items-center justify-center">
        <p className="text-[8px] text-gray-300 tracking-[0.15em] uppercase">
          ShortStamp · AI Legitimacy Check
        </p>
      </div>
    </div>
  );
}
