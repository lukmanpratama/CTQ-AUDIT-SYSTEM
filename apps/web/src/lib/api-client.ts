// apps/web/src/lib/api-client.ts
// Centralized API client for all HTTP calls to NestJS backend

const API_BASE = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL || 'http://192.168.43.210:3001');

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('ctq_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      code: 'UNKNOWN_ERROR',
      message: 'Request failed',
    }));
    throw new ApiError(
      errorBody.code || 'UNKNOWN_ERROR',
      errorBody.message || 'Request failed',
      response.status,
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (text) {
    try {
      return JSON.parse(text);
    } catch (parseError) {
      if (text.includes('Internal Server')) {
        throw new ApiError('PROXY_OFFLINE', 'Backend Server may be starting or offline.', response.status || 500);
      }
      throw new ApiError('PARSE_ERROR', 'Received invalid JSON data from server', 500);
    }
  }
  return null as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
