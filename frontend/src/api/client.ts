import type { FeedResponse, FeedMode, ProfileResponse, SearchResponse, User, Post } from '@/types';

const API_BASE = '/api';

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const err = await response.json();
      message = err.error || message;
    } catch {}
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────
  me: () =>
    apiRequest<{ user: User }>('/auth/me'),

  login: (credentials: { username: string; password: string }) =>
    apiRequest<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (credentials: { username: string; password: string }) =>
    apiRequest<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),

  // ── Posts ─────────────────────────────────────────────────────────
  getFeed: (params: { page?: number; mode?: FeedMode } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.mode) qs.set('mode', params.mode);
    return apiRequest<FeedResponse>(`/posts?${qs}`);
  },

  createPost: (content: string) =>
    apiRequest<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deletePost: (postId: number) =>
    apiRequest<{ message: string }>(`/posts/${postId}`, { method: 'DELETE' }),

  // ── Users ─────────────────────────────────────────────────────────
  getProfile: (username: string, page = 1) => {
    const qs = new URLSearchParams({ page: String(page) });
    return apiRequest<ProfileResponse>(`/users/${username}?${qs}`);
  },

  followUser: (username: string) =>
    apiRequest<{ success: boolean; followers_count: number }>(`/users/${username}/follow`, {
      method: 'POST',
    }),

  unfollowUser: (username: string) =>
    apiRequest<{ success: boolean; followers_count: number }>(`/users/${username}/unfollow`, {
      method: 'POST',
    }),

  editProfile: (data: { interests?: string; avatar?: File }) => {
    const form = new FormData();
    if (data.interests !== undefined) form.append('interests', data.interests);
    if (data.avatar) form.append('avatar', data.avatar);

    return fetch(`${API_BASE}/users/me/profile`, {
      method: 'PATCH',
      credentials: 'include',
      body: form,
      // НЕ ставим Content-Type — браузер сам выставит multipart/form-data
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка при сохранении');
      }
      return res.json() as Promise<{ user: User }>;
    });
  },

  // ── Search ────────────────────────────────────────────────────────
  search: (query: string, page = 1) => {
    const qs = new URLSearchParams({ q: query, page: String(page) });
    return apiRequest<SearchResponse>(`/search?${qs}`);
  },
};
