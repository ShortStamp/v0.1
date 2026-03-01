import { NextRequest, NextResponse } from "next/server";

// Allow up to 60 s — covers Render free-tier cold starts (~30 s)
export const maxDuration = 60;

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

async function proxy(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  // Strip the Next.js origin; keep /api/... path + query
  const target = `${BACKEND}${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const noBody = ["GET", "HEAD"].includes(req.method);
  const body = noBody ? undefined : await req.arrayBuffer();

  const init: RequestInit = {
    method: req.method,
    headers,
    body: noBody ? undefined : body,
  };

  try {
    const upstream = await fetch(target, init);

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding"); // avoid double-decompression
    responseHeaders.delete("content-length");   // body may be re-chunked by Next.js

    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[proxy] error:", err);
    return new NextResponse(
      JSON.stringify({ detail: "Proxy error: " + String(err) }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
