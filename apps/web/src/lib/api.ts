export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)xc_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

/** Fetch wrapper: JSON in/out, cookies always sent, ApiError on non-2xx.
 *  Mutating requests attach the double-submit CSRF token header automatically. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
  // FormData bodies must keep their own multipart boundary — only force JSON
  // when we are actually sending a string body.
  if (typeof init?.body === 'string') headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = csrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers
  });

  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
  const data: unknown = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      data !== null &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}
