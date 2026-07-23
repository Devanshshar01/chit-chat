import { API_BASE_URL } from '../config';

interface ApiErrorShape {
  detail?: string;
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as ApiErrorShape;
    if (typeof candidate.detail === 'string') {
      return candidate.detail;
    }
  }

  return 'The request could not be completed.';
}

export async function authFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  if (init.body instanceof FormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
}
