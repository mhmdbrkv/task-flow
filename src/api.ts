const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

let accessToken: string | null = sessionStorage.getItem('taskflow_access_token');
let refreshInFlight: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('taskflow_access_token', token);
  else sessionStorage.removeItem('taskflow_access_token');
}

export function getAccessToken() {
  return accessToken;
}

function payloadMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (Array.isArray(record.message)) {
    return record.message.filter((item): item is string => typeof item === 'string').join(', ');
  }
  return fallback;
}

async function requestRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        const token = payload?.data?.accessToken;
        if (typeof token !== 'string') {
          throw new ApiError('حصلت مشكلة وإحنا بنجدّد الجلسة. جرّب تسجل دخول تاني.', response.status);
        }
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retrying = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      `مش قادرين نوصل للخدمة على ${API_BASE_URL}. اتأكد إنها شغالة وإن إعداد VITE_API_BASE_URL مظبوط.`,
      0,
    );
  }

  if (response.status === 401 && !retrying && !path.startsWith('/auth/')) {
    const hadAccessToken = Boolean(accessToken);
    const token = await requestRefresh();
    if (token) return api<T>(path, options, true);
    setAccessToken(null);
    if (hadAccessToken) window.dispatchEvent(new Event('taskflow:unauthorized'));
    throw new ApiError('جلستك خلصت. سجّل دخولك تاني من فضلك.', 401);
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const fallback =
      response.status === 403
        ? 'مش مسموحلك تعمل الخطوة دي. ممكن صلاحياتك في المشروع اتغيرت.'
        : `الطلب ماكملش (${response.status}). جرّب تاني.`;
    if (response.status === 403) window.dispatchEvent(new Event('taskflow:forbidden'));
    throw new ApiError(payloadMessage(payload, fallback), response.status);
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  return payload && typeof payload === 'object' && 'data' in payload
    ? (payload.data as T)
    : (payload as T);
}

export function decodeUserId(token: string): string | null {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(normalized));
    if (
      claims &&
      typeof claims === 'object' &&
      'sub' in claims &&
      typeof claims.sub === 'string'
    ) {
      return claims.sub;
    }
    return null;
  } catch {
    return null;
  }
}
