import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    shortstamp: {
      captureScreen: () => Promise<string>;
      analyze: (imageBase64: string, hint?: string) => Promise<AnalysisResult>;
      analyzeText: (text: string, mode: "factcheck" | "ai_detection") => Promise<AnalysisResult>;
      analyzeUrl: (url: string, mode: "video" | "ai_detection") => Promise<AnalysisResult>;
      readClipboard: () => Promise<string>;
      login: (email: string, password: string) => Promise<{ email: string; subscription_status: string }>;
      getAuthState: () => Promise<{ token: string; email: string } | null>;
      logout: () => Promise<boolean>;
      hide: () => void;
      close: () => void;
      onStartAnalysis: (callback: () => void) => () => void;
    };
  }
}

type Verdict = "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
type AppState = "idle" | "analyzing" | "result" | "error";
type Mode = "screen" | "highlight" | "video" | "ai";

interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  explanation: string;
  category: string;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  REAL: "REAL",
  FAKE: "FAKE",
  SCAM: "SCAM",
  AI_GENERATED: "AI GEN",
  UNCERTAIN: "UNCERTAIN",
};

const INPUT_PLACEHOLDER: Record<Mode, string> = {
  screen: "Type a hint or question about your screen...",
  highlight: "Copy text on screen, then press ⌘⇧S to fact-check it",
  video: "Paste a video URL to analyze...",
  ai: "Paste text or a video URL to detect AI...",
};

const isMac = navigator.platform.toLowerCase().includes("mac");
const shortcutHint = isMac ? "⌘⇧S" : "Ctrl+Shift+S";

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [mode, setMode] = useState<Mode>("screen");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleMode = (m: Mode) => {
    setMode((prev) => (prev === m ? "screen" : m));
    if (m !== "highlight") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const startDismissTimer = (delay: number) => {
    dismissTimer.current = setTimeout(() => setAppState("idle"), delay);
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setAppState("idle");
  };

  const runAnalysis = async () => {
    if (appState === "analyzing") return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setAppState("analyzing");
    setResult(null);
    setErrorMessage(null);

    try {
      let analysisResult: AnalysisResult;

      if (mode === "highlight") {
        const text = await window.shortstamp.readClipboard();
        if (!text.trim()) throw new Error("No text found — copy text first, then press " + shortcutHint);
        analysisResult = await window.shortstamp.analyzeText(text, "factcheck");

      } else if (mode === "video") {
        if (!inputText.trim()) throw new Error("Paste a video URL to analyze");
        analysisResult = await window.shortstamp.analyzeUrl(inputText.trim(), "video");

      } else if (mode === "ai") {
        if (!inputText.trim()) throw new Error("Paste text or a URL to check");
        const isUrl = /^https?:\/\//i.test(inputText.trim());
        if (isUrl) {
          analysisResult = await window.shortstamp.analyzeUrl(inputText.trim(), "ai_detection");
        } else {
          analysisResult = await window.shortstamp.analyzeText(inputText.trim(), "ai_detection");
        }

      } else {
        const imageBase64 = await window.shortstamp.captureScreen();
        analysisResult = await window.shortstamp.analyze(imageBase64, inputText.trim() || undefined);
      }

      setResult(analysisResult);
      setAppState("result");
      startDismissTimer(10000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Analysis failed");
      setAppState("error");
      startDismissTimer(6000);
    }
  };

  useEffect(() => {
    const cleanup = window.shortstamp.onStartAnalysis(runAnalysis);
    return cleanup;
  }, [mode, inputText]);

  const analyzeLabel =
    mode === "highlight" ? "Check clipboard"
    : mode === "video"   ? "Analyze video"
    : mode === "ai"      ? "Detect AI"
    : "Analyze screen";

  return (
    <div className="widget-root">
      {/* ── Row 1: brand / result / actions ── */}
      <div className="bar-row drag-region">
        <div className="bar-brand no-drag">
          <div className="brand-mark">SS</div>
          <span className="brand-name">SHORTSTAMP</span>
        </div>

        <div className="bar-sep" />

        <div className="bar-content no-drag">
          {appState === "idle" && (
            <span className="idle-hint">
              {mode === "screen"
                ? <>Press <kbd>{shortcutHint}</kbd> to check your screen</>
                : <><span className="mode-active-hint">{analyzeLabel}</span> — {mode === "highlight" ? "copy text then press " : "paste input below then press "}<kbd>{shortcutHint}</kbd></>
              }
            </span>
          )}

          {appState === "analyzing" && (
            <div className="analyzing-row">
              <div className="analyzing-dots"><span /><span /><span /></div>
              <span className="state-label">{analyzeLabel}...</span>
            </div>
          )}

          {appState === "result" && result && (
            <div className="result-row">
              <span className={`verdict-chip verdict-${result.verdict}`}>
                {VERDICT_LABEL[result.verdict]}
              </span>
              <div className="inline-sep" />
              <span className="explanation">{result.explanation}</span>
              <span className="confidence">{result.confidence}%</span>
              <button className="dismiss-btn" onClick={dismiss}>×</button>
            </div>
          )}

          {appState === "error" && (
            <div className="result-row">
              <span className="verdict-chip verdict-error">ERROR</span>
              <div className="inline-sep" />
              <span className="explanation">{errorMessage}</span>
              <button className="dismiss-btn" onClick={dismiss}>×</button>
            </div>
          )}
        </div>

        <div className="bar-sep" />

        <div className="bar-actions no-drag">
          <button
            className={`scan-btn ${appState === "analyzing" ? "scanning" : ""}`}
            onClick={runAnalysis}
            disabled={appState === "analyzing"}
            title={analyzeLabel}
          >
            <ScanIcon />
          </button>
          <button className="close-bar-btn" onClick={() => window.shortstamp.hide()} title="Hide">
            ×
          </button>
        </div>
      </div>

      {/* ── Row 2: toolbar ── */}
      <div className="toolbar-row no-drag">
        <div className="mode-buttons">
          <button
            className={`mode-btn ${mode === "highlight" ? "active" : ""}`}
            onClick={() => toggleMode("highlight")}
            title="Highlight & fact-check selected text"
          >
            <HighlightIcon />
          </button>
          <button
            className={`mode-btn ${mode === "video" ? "active" : ""}`}
            onClick={() => toggleMode("video")}
            title="Analyze a video by URL"
          >
            <VideoIcon />
          </button>
          <button
            className={`mode-btn ${mode === "ai" ? "active" : ""}`}
            onClick={() => toggleMode("ai")}
            title="Detect AI-generated content"
          >
            <AIIcon />
          </button>
        </div>

        <div className="toolbar-sep" />

        <input
          ref={inputRef}
          className="toolbar-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
          placeholder={INPUT_PLACEHOLDER[mode]}
          spellCheck={false}
        />

        {inputText.trim() && (
          <button className="submit-btn" onClick={runAnalysis} title="Submit">
            <SubmitIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function ScanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 4V2.5A1.5 1.5 0 0 1 2.5 1H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 1h1.5A1.5 1.5 0 0 1 15 2.5V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 12v1.5A1.5 1.5 0 0 1 13.5 15H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 15H2.5A1.5 1.5 0 0 1 1 13.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="6.5" y="6.5" width="3" height="3" rx="0.5" fill="currentColor"/>
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M10.5 2.5 L13.5 5.5 L6 13 L2.5 13.5 L3 10 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M8.5 4.5 L11.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2 15 L6 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M11 6.5 L15 4.5 L15 11.5 L11 9.5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function AIIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 4 L8.8 6.8 L11.5 6.8 L9.4 8.4 L10.2 11.2 L8 9.6 L5.8 11.2 L6.6 8.4 L4.5 6.8 L7.2 6.8 Z" fill="currentColor"/>
    </svg>
  );
}

function SubmitIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2 7 L12 7 M8 3 L12 7 L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
