import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  clipboard,
  dialog,
} from "electron";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import ffmpeg from "fluent-ffmpeg";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

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
ipcMain.on("window-resize", (_event, height: number) => {
  if (!overlayWindow) return;
  const { workArea } = screen.getPrimaryDisplay();
  overlayWindow.setSize(BAR_WIDTH, height);
  overlayWindow.setPosition(
    workArea.x + Math.floor((workArea.width - BAR_WIDTH) / 2),
    workArea.y,
  );
});

// ── File helpers ──────────────────────────────────────────────────────────────

async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        resolve(60); // fallback: assume 60s
      } else {
        resolve(metadata.format.duration as number);
      }
    });
  });
}

async function extractFramesAtTimes(videoPath: string, times: number[]): Promise<string[]> {
  const dir = tmpdir();
  const frames: string[] = [];

  for (const t of times) {
    const outPath = join(dir, `ss_${Date.now()}_${Math.round(t * 1000)}.jpg`);
    await new Promise<void>((resolve) => {
      ffmpeg(videoPath)
        .seekInput(t)
        .frames(1)
        .size("1280x?")
        .output(outPath)
        .on("end", () => resolve())
        .on("error", () => resolve())
        .run();
    });
    try {
      if (existsSync(outPath)) {
        frames.push(readFileSync(outPath).toString("base64"));
        unlinkSync(outPath);
      }
    } catch { /* skip */ }
  }

  return frames;
}

async function extractVideoFrames(videoPath: string): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);

  // 8 evenly-spaced frames across the full video
  const step = duration / 9;
  const evenTimes = Array.from({ length: 8 }, (_, i) => step * (i + 1));

  // 3 burst clusters (4 frames each, 0.1s apart) at 20%, 50%, 75%
  // Tight spacing reveals per-frame morphing/flickering that exposes AI generation
  const burstOffsets = [0, 0.1, 0.2, 0.3];
  const burst1 = burstOffsets.map((o) => duration * 0.20 + o);
  const burst2 = burstOffsets.map((o) => duration * 0.50 + o);
  const burst3 = burstOffsets.map((o) => duration * 0.75 + o);

  const allTimes = [...evenTimes, ...burst1, ...burst2, ...burst3];
  return extractFramesAtTimes(videoPath, allTimes);
}

async function apiPost(path: string, body: object): Promise<object> {
  const token = storeGet("token");
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) { storeDelete("token"); storeDelete("email"); throw new Error("Session expired"); }
    if (response.status === 402) throw new Error("Subscription required");
    const data = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error(data.detail || `API error ${response.status}`);
  }
  return response.json();
}

// IPC: open native file picker
ipcMain.handle("open-file-picker", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Supported Files",
        extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "mp4", "mov", "avi", "mkv", "webm", "m4v", "txt", "md", "csv", "json", "pdf"],
      },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: analyze a local file (image / text / PDF / video)
// mode: "screen" | "highlight" | "video" | "ai"
ipcMain.handle("analyze-file", async (_event, filePath: string, mode: string = "screen") => {
  const ext = (filePath.split(".").pop() ?? "").toLowerCase();

  // ── Images ──────────────────────────────────────────
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) {
    const mediaType =
      ext === "png" ? "image/png"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : "image/jpeg";
    const hint = mode === "ai" ? "Focus on detecting AI-generated or deepfake content."
      : mode === "highlight" ? "Fact-check any claims visible in this image."
      : undefined;
    return apiPost("/analyze", {
      image_base64: readFileSync(filePath).toString("base64"),
      media_type: mediaType,
      ...(hint ? { hint } : {}),
    });
  }

  // ── Text / PDF ───────────────────────────────────────
  if (["txt", "md", "csv", "json", "pdf"].includes(ext)) {
    let text: string;
    if (ext === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(readFileSync(filePath));
      text = (data.text as string).slice(0, 8000);
    } else {
      text = readFileSync(filePath, "utf-8").slice(0, 8000);
    }
    const textMode = mode === "ai" ? "ai_detection" : "factcheck";
    return apiPost("/analyze-text", { text, mode: textMode });
  }

  // ── Video ────────────────────────────────────────────
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) {
    const frames = await extractVideoFrames(filePath);
    if (frames.length === 0) throw new Error("Could not extract frames from this video file.");
    const videoMode = mode === "ai" ? "ai_detection" : "video";
    return apiPost("/analyze-frames", { frames, mode: videoMode });
  }

  throw new Error(`Unsupported file type: .${ext}`);
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
