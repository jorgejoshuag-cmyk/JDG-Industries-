// Polite HTTP for source adapters: HTTPS only, public hosts only, timeout, retry with backoff.

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The source URL is not a valid address.");
  }
  if (url.protocol !== "https:") throw new Error("The source URL must start with https://");
  if (PRIVATE_HOST.test(url.hostname) || !url.hostname.includes(".")) throw new Error("The source URL must be a public internet address.");
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url: string, init: RequestInit = {}, attempts = 4): Promise<unknown> {
  assertPublicHttpsUrl(url);
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        lastError = new Error(`Source responded with HTTP ${res.status}`);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1000 * 2 ** i);
        continue;
      }
      if (!res.ok) throw new Error(`Source responded with HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      if (e instanceof Error && /HTTP 4\d\d|valid address|https|public internet/.test(e.message)) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Source request failed");
}

/** Pause between pages so we stay well inside public rate limits. */
export const politePause = () => sleep(400);

export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
