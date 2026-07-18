import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// ── Storage helpers ─────────────────────────────────────────────────────────────

const AUTH_KEY = 'ars-auth';

interface StoredAuth {
  token: string | null;
  refreshToken: string | null;
}

function readAuth(): StoredAuth {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { token: null, refreshToken: null };
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? {};
    return {
      token: state.token ?? null,
      refreshToken: state.refreshToken ?? null,
    };
  } catch {
    return { token: null, refreshToken: null };
  }
}

function patchAccessToken(accessToken: string): void {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state = { ...(parsed.state ?? {}), token: accessToken };
    localStorage.setItem(AUTH_KEY, JSON.stringify(parsed));
  } catch {
    // ignore — the store will still work from memory
  }
}

function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

// ── Axios instance ──────────────────────────────────────────────────────────────

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request interceptor: attach Bearer token ────────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { token } = readAuth();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: unwrap envelope + silent token refresh ────────────────
//
// The backend always wraps success responses as:
//   { success: true, data: <payload>, timestamp: string }
// and error responses as:
//   { success: false, statusCode, message, errors, timestamp, path }
//
// We transparently unwrap `data` so callers never see the envelope.

// FIX (bug #2): these are public, unauthenticated auth endpoints. A 401
// from any of them means "bad credentials" / "bad token", not "your
// session expired" — they must NOT trigger the silent-refresh flow, or a
// wrong password on the login form causes clearAuth() + a hard redirect
// instead of letting the form show the real error message.
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

let _refreshing = false;
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let _queue: QueueEntry[] = [];

function flushQueue(err: unknown, token: string | null): void {
  _queue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token as string),
  );
  _queue = [];
}

api.interceptors.response.use(
  (res: AxiosResponse) => {
    const body = res.data;
    // Unwrap { success, data, timestamp } envelope
    if (
      body !== null &&
      typeof body === 'object' &&
      'success' in body &&
      'data' in body
    ) {
      return { ...res, data: body.data };
    }
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ── 401: attempt silent refresh (but never for public auth routes) ────────
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !isPublicAuthRequest(original?.url)
    ) {
      const { refreshToken } = readAuth();

      if (!refreshToken) {
        clearAuth();
        window.location.replace('/login');
        return Promise.reject(error);
      }

      // If a refresh is already in-flight, queue this request
      if (_refreshing) {
        return new Promise<string>((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        });
      }

      original._retry = true;
      _refreshing = true;

      try {
        // FIX (bug #3): BASE_URL already ends in '/v1' — no need to strip
        // and re-append it. This also uses a raw axios.post (not the `api`
        // instance) deliberately, so a 401 here can't recurse back into
        // this same interceptor.
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 10_000 },
        );

        // Handle both wrapped and unwrapped response shapes
        const newToken: string =
          (data as { data?: { accessToken?: string } })?.data?.accessToken ??
          (data as { accessToken?: string })?.accessToken ??
          '';

        if (!newToken) throw new Error('Refresh response missing accessToken');

        patchAccessToken(newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        flushQueue(null, newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        clearAuth();
        window.location.replace('/login');
        return Promise.reject(refreshErr);
      } finally {
        _refreshing = false;
      }
    }

    // ── Surface backend error message ──────────────────────────────────────────
    const serverMsg = (
      error.response?.data as Record<string, unknown> | undefined
    )?.message as string | undefined;

    if (serverMsg) {
      (error as AxiosError & { userMessage: string }).userMessage = serverMsg;
    }

    return Promise.reject(error);
  },
);

// ── Utility exported alongside the instance ─────────────────────────────────────

/** Extract a human-readable error message from any thrown value */
export function extractErrorMessage(
  err: unknown,
  fallback = 'Une erreur inattendue est survenue',
): string {
  if (!err) return fallback;
  const e = err as AxiosError & { userMessage?: string };
  return (
    e.userMessage ??
    ((e.response?.data as Record<string, unknown>)?.message as string | undefined) ??
    e.message ??
    fallback
  );
}

export default api;