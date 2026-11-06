/** Browser helper for calling /api/v1 with JSON. Errors follow { error: { code, message, fields? } }. */

export interface ApiFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
}

export type ApiResult<T> = ({ ok: true } & T) | ApiFailure;

export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK",
      message: "We could not reach the server. Check your connection and try again.",
    };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = (data as { error?: Partial<ApiFailure> } | null)?.error;
    return {
      ok: false,
      status: res.status,
      code: err?.code ?? "UNKNOWN",
      message: err?.message ?? "Something went wrong. Please try again.",
      fields: err?.fields,
      retryAfterSeconds: err?.retryAfterSeconds,
    };
  }
  return { ok: true, ...(data as T) };
}
