import type { FeedResponse, FeedMode, ProfileResponse, SearchResponse, User, Post } from '@/types';

const API_BASE = '/api';

// ── Токены ───────────────────────────────────────────────────────────────────

export const TokenStorage = {
  getAccess:  (): string | null => localStorage.getItem('access_token'),
  getRefresh: (): string | null => localStorage.getItem('refresh_token'),
  set: (access: string, refresh: string): void => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  },
  clear: (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// ── Очередь запросов во время refresh ────────────────────────────────────────

type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((item) => (error ? item.reject(error) : item.resolve(token!)));
  failedQueue = [];
}

// ── Принудительный выход при истечении refresh-токена ────────────────────────

function handleAuthFailure(): never {
  TokenStorage.clear();
  window.location.href = '/login';
  // never — функция не возвращает управление (редирект), но TS этого не знает
  throw new Error('Session expired');
}

// БАГ 2 (исправлен): сохраняем ОБА токена — бэкенд может вернуть новый refresh
async function refreshAccessToken(): Promise<string> {
  const refreshToken = TokenStorage.getRefresh();

  // БАГ 4 (исправлен): нет refresh-токена = сессия полностью истекла
  if (!refreshToken) {
    handleAuthFailure();
  }

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshToken}` },
  });

  // БАГ 4 (исправлен): refresh вернул 401/403 = refresh-токен истёк (7 дней прошло)
  if (res.status === 401 || res.status === 403) {
    handleAuthFailure();
  }

  if (!res.ok) {
    throw new Error(`Refresh request failed: ${res.status}`);
  }

  const data = await res.json();

  // БАГ 2 (исправлен): обновляем оба токена если бэкенд вернул refresh_token,
  // иначе оставляем старый refresh
  TokenStorage.set(
    data.access_token,
    data.refresh_token ?? TokenStorage.getRefresh()!,
  );

  return data.access_token as string;
}

// ── Базовая функция запроса ───────────────────────────────────────────────────

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const isFormData = fetchOptions.body instanceof FormData;

  // БАГ 3 (исправлен): makeRequest каждый раз создаёт НОВЫЙ объект Headers
  // со свежим токеном — не мутирует захваченный в замыкании объект
  const buildHeaders = (overrideToken?: string): Headers => {
    const h = new Headers(fetchOptions.headers);
    if (!isFormData) h.set('Content-Type', 'application/json');
    const token = overrideToken ?? (!skipAuth ? TokenStorage.getAccess() : null);
    if (token) h.set('Authorization', `Bearer ${token}`);
    return h;
  };

  const makeRequest = (overrideToken?: string): Promise<Response> =>
    fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers: buildHeaders(overrideToken),
    });

  let response = await makeRequest();

  // ── 401: обновляем токен и повторяем запрос ──────────────────────────────
  if (response.status === 401 && !skipAuth) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: async (newToken) => {
            try { resolve(await parseResponse<T>(await makeRequest(newToken))); }
            catch (err) { reject(err); }
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      response = await makeRequest(newToken);

      // БАГ 1 (исправлен): retry после refresh тоже вернул 401 —
      // значит проблема не в токене, а в правах доступа → выходим
      if (response.status === 401) {
        handleAuthFailure();
      }
    } catch (err) {
      processQueue(err, null);
      // handleAuthFailure уже вызван внутри refreshAccessToken при 401/403,
      // здесь ловим остальные сетевые ошибки
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const err = await response.json();
      message = err.error || err.errors?.[0]?.msg || message;
    } catch { /* пустой ответ */ }
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ── API-методы ───────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────

  me: () =>
    apiRequest<User>('/auth/me'),

  // email вместо username — новый бэк требует email
  login: (credentials: { email: string; password: string }) =>
    apiRequest<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(credentials), skipAuth: true },
    ).then((data) => {
      TokenStorage.set(data.access_token, data.refresh_token);
      return data.user;
    }),

  register: (credentials: { email: string; username: string; password: string }) =>
    apiRequest<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(credentials), skipAuth: true },
    ).then((data) => {
      TokenStorage.set(data.access_token, data.refresh_token);
      return data.user;
    }),

  logout: () =>
    apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' })
      .finally(() => TokenStorage.clear()),

  // ── Posts ─────────────────────────────────────────────────────────────────

  getFeed: (params: { page?: number; mode?: FeedMode } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.mode) qs.set('mode', params.mode);
    return apiRequest<FeedResponse>(`/posts/feed?${qs}`);
  },

  createPost: (content: string) =>
    apiRequest<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deletePost: (postId: number) =>
    apiRequest<{ ok: boolean }>(`/posts/${postId}`, { method: 'DELETE' }),

  // ── Users ─────────────────────────────────────────────────────────────────

  getProfile: (username: string, page = 1) => {
    const qs = new URLSearchParams({ page: String(page) });
    return apiRequest<ProfileResponse>(`/users/${username}?${qs}`);
  },

  followUser: (username: string) =>
    apiRequest<{ ok: boolean; followers: number }>(`/users/${username}/follow`, {
      method: 'POST',
    }),

  unfollowUser: (username: string) =>
    apiRequest<{ ok: boolean; followers: number }>(`/users/${username}/unfollow`, {
      method: 'POST',
    }),

  editProfile: (data: { bio?: string; avatar?: File }) => {
    const form = new FormData();
    if (data.bio !== undefined) form.append('bio', data.bio);
    if (data.avatar) form.append('avatar', data.avatar);
    return apiRequest<User>('/users/me', { method: 'PATCH', body: form });
  },

  // ── Search ────────────────────────────────────────────────────────────────

  search: (query: string, page = 1) => {
    const qs = new URLSearchParams({ q: query, page: String(page) });
    return apiRequest<SearchResponse>(`/search?${qs}`);
  },
};