import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

async function proxy(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  // Strip the Next.js origin; keep /api/... path + query
  const target = `${BACKEND}${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    // @ts-expect-error – Node 18 fetch supports duplex for streaming bodies
    duplex: "half",
  };

  const upstream = await fetch(target, init);

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding"); // avoid double-decompression

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
