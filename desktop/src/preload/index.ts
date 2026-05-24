import { contextBridge, ipcRenderer } from "electron";

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld("shortstamp", {
  // Screen capture
  captureScreen: (): Promise<string> => ipcRenderer.invoke("capture-screen"),

  // Analysis
  analyze: (
    imageBase64: string,
    hint?: string
  ): Promise<{
    verdict: "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN";
    confidence: number;
    explanation: string;
    category: "fact" | "link" | "media" | "general";
  }> => ipcRenderer.invoke("analyze", imageBase64, hint),

  // Auth
  login: (
    email: string,
    password: string
  ): Promise<{ email: string; subscription_status: string }> =>
    ipcRenderer.invoke("auth-login", email, password),

  getAuthState: (): Promise<{ token: string; email: string } | null> =>
    ipcRenderer.invoke("auth-get-state"),

  logout: (): Promise<boolean> => ipcRenderer.invoke("auth-logout"),

  // Window controls
  hide: (): void => ipcRenderer.send("window-hide"),
  close: (): void => ipcRenderer.send("window-close"),
});
