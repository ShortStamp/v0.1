import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
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

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 620,
    x: width - 440,
    y: Math.floor(height / 2) - 310,
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
    titleBarStyle: "hidden",
    vibrancy: "under-window",
    visualEffectState: "active",
    hasShadow: true,
  });

  overlayWindow.setWindowButtonVisibility?.(false);

  if (isDev) {
    overlayWindow.loadURL("http://localhost:5173");
    // overlayWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    overlayWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.show();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  // Prevent the window from appearing in screenshots
  overlayWindow.setContentProtection(true);
}

function toggleOverlay(): void {
  if (!overlayWindow) {
    createOverlayWindow();
    return;
  }

  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
    overlayWindow.focus();
  }
}

// IPC: capture the screen (hide overlay first to avoid capturing it)
ipcMain.handle("capture-screen", async (): Promise<string> => {
  const wasVisible = overlayWindow?.isVisible() ?? false;

  // Briefly hide the overlay so it doesn't appear in the screenshot
  if (wasVisible) {
    overlayWindow?.hide();
    // Small delay to let the OS composit the screen without our window
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const primarySource = sources[0];
    if (!primarySource) {
      throw new Error("No screen source available");
    }

    const thumbnail = primarySource.thumbnail;
    const pngBuffer = thumbnail.toPNG();
    const base64 = pngBuffer.toString("base64");
    return base64;
  } finally {
    if (wasVisible) {
      overlayWindow?.show();
    }
  }
});

// IPC: send screenshot to backend for analysis
ipcMain.handle(
  "analyze",
  async (_event, imageBase64: string, hint?: string) => {
    const token = storeGet("token");
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ image_base64: imageBase64, hint }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        store.delete("token");
        store.delete("email");
        throw new Error("Session expired — please log in again");
      }
      if (response.status === 402) {
        throw new Error("Subscription required");
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || `API error ${response.status}`);
    }

    return response.json();
  }
);

// IPC: auth — store token
ipcMain.handle(
  "auth-login",
  async (_event, email: string, password: string) => {
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
  }
);

// IPC: get stored auth state
ipcMain.handle("auth-get-state", () => {
  const token = storeGet("token");
  const email = storeGet("email");
  return token ? { token, email } : null;
});

// IPC: logout
ipcMain.handle("auth-logout", () => {
  storeDelete("token");
  storeDelete("email");
  return true;
});

// IPC: close/minimize
ipcMain.on("window-hide", () => overlayWindow?.hide());
ipcMain.on("window-close", () => {
  overlayWindow?.close();
  overlayWindow = null;
});

app.whenReady().then(() => {
  createOverlayWindow();

  // Register global shortcut
  const shortcut = process.platform === "darwin" ? "Command+Shift+S" : "Control+Shift+S";
  globalShortcut.register(shortcut, toggleOverlay);

  app.on("activate", () => {
    if (!overlayWindow) {
      createOverlayWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Keep running in background — don't quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // On non-Mac, just quit
    app.quit();
  }
});
