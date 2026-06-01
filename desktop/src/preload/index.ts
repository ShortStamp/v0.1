import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("shortstamp", {
  captureScreen: (): Promise<string> => ipcRenderer.invoke("capture-screen"),

  analyze: (
    imageBase64: string,
    hint?: string
  ): Promise<{
    verdict: "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
    confidence: number;
    explanation: string;
    category: string;
  }> => ipcRenderer.invoke("analyze", imageBase64, hint),

  analyzeText: (
    text: string,
    mode: "factcheck" | "ai_detection"
  ): Promise<{
    verdict: "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
    confidence: number;
    explanation: string;
    category: string;
  }> => ipcRenderer.invoke("analyze-text", text, mode),

  analyzeUrl: (
    url: string,
    mode: "video" | "ai_detection"
  ): Promise<{
    verdict: "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
    confidence: number;
    explanation: string;
    category: string;
  }> => ipcRenderer.invoke("analyze-url", url, mode),

  readClipboard: (): Promise<string> => ipcRenderer.invoke("read-clipboard"),

  login: (
    email: string,
    password: string
  ): Promise<{ email: string; subscription_status: string }> =>
    ipcRenderer.invoke("auth-login", email, password),

  getAuthState: (): Promise<{ token: string; email: string } | null> =>
    ipcRenderer.invoke("auth-get-state"),

  logout: (): Promise<boolean> => ipcRenderer.invoke("auth-logout"),

  hide: (): void => ipcRenderer.send("window-hide"),
  close: (): void => ipcRenderer.send("window-close"),
  resize: (height: number): void => ipcRenderer.send("window-resize", height),

  openFilePicker: (): Promise<string | null> => ipcRenderer.invoke("open-file-picker"),
  analyzeFile: (filePath: string, mode: string): Promise<{
    verdict: "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
    confidence: number;
    explanation: string;
    category: string;
  }> => ipcRenderer.invoke("analyze-file", filePath, mode),

  onStartAnalysis: (callback: () => void) => {
    ipcRenderer.on("start-analysis", callback);
    return () => ipcRenderer.removeListener("start-analysis", callback);
  },
});
