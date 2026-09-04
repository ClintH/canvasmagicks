import type { CanvasConfig } from "./config";
import { normalizeDomain } from "./canvas";

export class CanvasApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`Canvas API returned ${status} ${message}`);
    this.name = "CanvasApiError";
  }
}

type Params = Record<string, string | number | boolean | string[] | undefined>;

// Builds an `application/x-www-form-urlencoded` body where each key is namespaced
// under `prefix`, e.g. `{ title: "x" }` with prefix "calendar_event" becomes
// `calendar_event[title]=x`. This is the convention Canvas uses for nested params.
export function buildForm(
  values: Record<string, string | number | boolean | undefined>,
  prefix: string,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    sp.set(`${prefix}[${key}]`, String(value));
  }
  return sp;
}

// Centralises auth, base-URL construction, request execution, error handling and
// pagination so the feature modules don't repeat low-level HTTP plumbing.
export class CanvasClient {
  private readonly base: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly config: CanvasConfig) {
    this.base = `${normalizeDomain(config.domain).replace(/\/+$/, "")}/api/v1`;
    this.headers = {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    };
  }

  private url(path: string, params?: Params): string {
    const full = path.startsWith("/") ? path : `/${path}`;
    if (!params) return `${this.base}${full}`;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) sp.append(k, String(item));
      } else {
        sp.set(k, String(v));
      }
    }
    const qs = sp.toString();
    return qs ? `${this.base}${full}?${qs}` : `${this.base}${full}`;
  }

  async get(path: string, params?: Params): Promise<unknown> {
    return this.request("GET", this.url(path, params));
  }

  async postForm(path: string, body: URLSearchParams): Promise<unknown> {
    return this.request("POST", this.url(path), body);
  }

  async putForm(path: string, body: URLSearchParams): Promise<unknown> {
    return this.request("PUT", this.url(path), body);
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.url(path), { method: "DELETE", headers: this.headers });
    if (!res.ok) {
      throw new CanvasApiError(res.status, res.statusText);
    }
  }

  // Follows Link `rel="next"` pagination and returns every page concatenated.
  async getAll(path: string, params?: Params): Promise<unknown[]> {
    const out: unknown[] = [];
    let next: string | undefined = this.url(path, params);
    while (next) {
      const res = await fetch(next, { headers: this.headers });
      if (!res.ok) {
        throw new CanvasApiError(res.status, res.statusText);
      }
      const link = res.headers.get("Link");
      next = undefined;
      if (link) {
        const match = link.match(/<([^>]+)>;\s*rel="next"/);
        if (match) next = match[1];
      }
      const batch = (await res.json()) as unknown[];
      out.push(...batch);
    }
    return out;
  }

  private async request(method: string, url: string, body?: URLSearchParams): Promise<unknown> {
    const res = await fetch(url, {
      method,
      headers: body
        ? { ...this.headers, "Content-Type": "application/x-www-form-urlencoded" }
        : this.headers,
      body,
    });
    if (!res.ok) {
      throw new CanvasApiError(res.status, res.statusText);
    }
    return (await res.json()) as unknown;
  }
}
