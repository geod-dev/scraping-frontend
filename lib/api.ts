import "server-only";

// Server-only client for the Competitor catalog API.
// The API key is read from the environment on the server and never reaches the browser.

const DEFAULT_BASE_URL =
  "https://api-haoyfwryqzh3rskh66g9evxy.185.252.233.123.sslip.io/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Clearer wording for error codes the UI can hit; other codes keep the API message.
const ERROR_MESSAGES: Record<string, string> = {
  matching_reference: "Antalis is the reference catalog: its products are not matched.",
  reference_catalog_required: "The Antalis catalog has not been fully synced yet: run an Antalis catalog sync first.",
  reference_missing: "The Antalis catalog is not in the database yet.",
  matching_not_configured: "Matching is not configured on the server (no Voyage API key).",
  match_not_found: "This product has not been matched yet.",
  invalid_antalis_product: "The chosen product is not an Antalis product.",
  antalis_product_required: "There is no proposal to validate: choose an Antalis product.",
  job_not_restartable: "Only interrupted, failed or cancelled jobs can be restarted.",
  nothing_to_retry: "This run has no failed pages left to retry.",
};

type QueryValue =string | number | boolean | null | undefined | Array<string | number>;

export type ApiRequest = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
};

function readConfig() {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "SCRAPER_API_KEY is not configured on the server.", "config");
  }
  const baseUrl = (process.env.SCRAPER_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

function buildQueryString(query: ApiRequest["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function extractMessage(payload: unknown, fallback: string): { message: string; code: string | null } {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (p.error && typeof p.error === "object") {
      const e = p.error as Record<string, unknown>;
      return {
        message: typeof e.message === "string" ? e.message : fallback,
        code: typeof e.code === "string" ? e.code : null,
      };
    }
    if (Array.isArray(p.detail)) {
      const first = p.detail[0] as { msg?: string; loc?: unknown[] } | undefined;
      const where = first?.loc?.filter((x) => x !== "body").join(".");
      return {
        message: first?.msg ? (where ? `${where}: ${first.msg}` : first.msg) : fallback,
        code: "validation_error",
      };
    }
    if (typeof p.detail === "string") return { message: p.detail, code: null };
  }
  return { message: fallback, code: null };
}

export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const { apiKey, baseUrl } = readConfig();
  const method = request.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Key": apiKey,
  };
  const hasBody = request.body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}${buildQueryString(request.query)}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(request.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, "The scraper API is unreachable right now.", "unreachable");
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const { message, code } = extractMessage(payload, `API request failed (${response.status}).`);
    throw new ApiError(response.status, (code && ERROR_MESSAGES[code]) || message, code);
  }

  return payload as T;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// Lets a page render other sections when one request fails.
export async function settle<T>(
  work: Promise<T>,
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await work, error: null };
  } catch (error) {
    return {
      data: null,
      error: isApiError(error) ? error.message : "Unexpected error while loading this section.",
    };
  }
}
