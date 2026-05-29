import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  clipboard,
} from "electron";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

// Simple file-based persistent store
function getStorePath(): string {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  return join(dir, "shortstamp-auth.json");
}

function storeGet(key: string): string | undefined {
  try {
    const path = getStorePath();
    if (!existsSync(path)) return undefined;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return data[key];
  } catch { return undefined; }
}

function storeSet(key: string, value: string): void {
  try {
    const path = getStorePath();
    const data = existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
    data[key] = value;
    writeFileSync(path, JSON.stringify(data));
  } catch {}
}

function storeDelete(key: string): void {
  try {
    const path = getStorePath();
    if (!existsSync(path)) return;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    delete data[key];
    writeFileSync(path, JSON.stringify(data));
  } catch {}
}

let overlayWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development";
const API_URL = process.env.SHOTSTAMP_API_URL || "http://localhost:8000";

const BAR_WIDTH = 720;
const BAR_HEIGHT = 96;

function createOverlayWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();

  overlayWindow = new BrowserWindow({
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    x: workArea.x + Math.floor((workArea.width - BAR_WIDTH) / 2),
    y: workArea.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    hasShadow: false,
    visibleOnAllWorkspaces: true,
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    overlayWindow.loadURL("http://localhost:5173");
  } else {
    overlayWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.show();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function triggerAnalysis(): void {
  if (!overlayWindow) {
    createOverlayWindow();
    overlayWindow!.once("ready-to-show", () => {
      overlayWindow?.show();
      overlayWindow?.webContents.send("start-analysis");
    });
    return;
  }

  if (!overlayWindow.isVisible()) overlayWindow.show();
  overlayWindow.webContents.send("start-analysis");
}

// IPC: capture the screen (hide overlay first)
ipcMain.handle("capture-screen", async (): Promise<string> => {
  const wasVisible = overlayWindow?.isVisible() ?? false;

  if (wasVisible) {
    overlayWindow?.hide();
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const primarySource = sources[0];
    if (!primarySource) throw new Error("No screen source available");

    const pngBuffer = primarySource.thumbnail.toPNG();
    return pngBuffer.toString("base64");
  } finally {
    if (wasVisible) overlayWindow?.show();
  }
});

// IPC: send screenshot to backend for analysis
ipcMain.handle("analyze", async (_event, imageBase64: string, hint?: string) => {
  const token = storeGet("token");

  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image_base64: imageBase64, hint }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      storeDelete("token");
      storeDelete("email");
      throw new Error("Session expired — please log in again");
    }
    if (response.status === 402) throw new Error("Subscription required");
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `API error ${response.status}`);
  }

  return response.json();
});

// IPC: read system clipboard
ipcMain.handle("read-clipboard", () => clipboard.readText());

// IPC: analyze plain text (highlight / AI detection mode)
ipcMain.handle("analyze-text", async (_event, text: string, mode: string) => {
  const token = storeGet("token");
  const response = await fetch(`${API_URL}/analyze-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, mode }),
  });
  if (!response.ok) {
    if (response.status === 401) { storeDelete("token"); storeDelete("email"); throw new Error("Session expired"); }
    if (response.status === 402) throw new Error("Subscription required");
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `API error ${response.status}`);
  }
  return response.json();
});

// IPC: analyze a URL (video reader / AI detection mode)
ipcMain.handle("analyze-url", async (_event, url: string, mode: string) => {
  const token = storeGet("token");
  const response = await fetch(`${API_URL}/analyze-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url, mode }),
  });
  if (!response.ok) {
    if (response.status === 401) { storeDelete("token"); storeDelete("email"); throw new Error("Session expired"); }
    if (response.status === 402) throw new Error("Subscription required");
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `API error ${response.status}`);
  }
  return response.json();
});

// IPC: auth
ipcMain.handle("auth-login", async (_event, email: string, password: string) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Login failed");
  }

  const data = await response.json();
  storeSet("token", data.access_token);
  storeSet("email", data.email);
  return { email: data.email, subscription_status: data.subscription_status };
});

ipcMain.handle("auth-get-state", () => {
  const token = storeGet("token");
  const email = storeGet("email");
  return token ? { token, email } : null;
});

ipcMain.handle("auth-logout", () => {
  storeDelete("token");
  storeDelete("email");
  return true;
});

// IPC: window controls
ipcMain.on("window-hide", () => overlayWindow?.hide());
ipcMain.on("window-close", () => {
  overlayWindow?.close();
  overlayWindow = null;
});

app.whenReady().then(() => {
  createOverlayWindow();

  const shortcut = process.platform === "darwin" ? "Command+Shift+S" : "Control+Shift+S";
  globalShortcut.register(shortcut, triggerAnalysis);

  app.on("activate", () => {
    if (!overlayWindow) createOverlayWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
