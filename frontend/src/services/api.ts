// ============================================================
// API SERVICE — подключается к Flask бэкенду
// ============================================================

import type { Post, Board, UserProfile } from '../data/mock-data';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── Хранилище токенов ────────────────────────────────────────────────────────

const TOKEN_KEY = 'niti_access_token';
const REFRESH_KEY = 'niti_refresh_token';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  save: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Базовый fetch: Bearer-токен + JSON ────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenStorage.getAccess();
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сети' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================
// AUTH
// ============================================================

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  avatar: string;
  bio?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

export const authApi = {
  async login(data: { identifier: string; password: string }): Promise<AuthUser> {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    tokenStorage.save(res.access_token, res.refresh_token);
    return res.user;
  },

  async register(data: { email: string; username: string; password: string }): Promise<AuthUser> {
    const res = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    tokenStorage.save(res.access_token, res.refresh_token);
    return res.user;
  },

  async restoreSession(): Promise<AuthUser | null> {
    if (!tokenStorage.getAccess()) return null;
    try {
      return await apiFetch<AuthUser>('/auth/me');
    } catch {
      tokenStorage.clear();
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      tokenStorage.clear();
    }
  },

  async me(): Promise<AuthUser | null> {
    return this.restoreSession();
  },
};

// ============================================================
// POSTS
// ============================================================

export const postsApi = {
  async getFeed(page = 1): Promise<Post[]> {
    const data = await apiFetch<{ posts: Post[] }>(`/posts/feed?page=${page}`);
    return data.posts;
  },

  async create(payload: {
    content?: string;
    title?: string;
    mood?: string;
    visibility?: 'public' | 'private';
    tags?: string[];
    postType?: string;
    board_id?: number;
  }): Promise<Post> {
    return apiFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
  },

  async uploadImage(postId: string | number, file: File): Promise<Post> {
    const token = tokenStorage.getAccess();
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${BASE_URL}/posts/${postId}/image`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Ошибка ${res.status}`);
    }
    return res.json();
  },

  async update(postId: string | number, payload: {
    content?: string;
    title?: string;
    mood?: string;
    visibility?: 'public' | 'private';
    tags?: string[];
  }): Promise<Post> {
    return apiFetch(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async getMyPosts(): Promise<Post[]> {
    return apiFetch('/posts/me');
  },

  async delete(postId: string): Promise<void> {
    return apiFetch(`/posts/${postId}`, { method: 'DELETE' });
  },

  async getUserPosts(username: string): Promise<Post[]> {
    const data = await apiFetch<{ posts: Post[] }>(`/users/${username}/posts`);
    return data.posts;
  },
};

// ============================================================
// REACTIONS
// ============================================================

export type ReactionType = 'like' | 'love' | 'laugh' | 'sad' | 'wow' | 'fire';

export interface ReactionCount {
  type: ReactionType;
  emoji: string;
  count: number;
}

export interface ToggleReactionResponse {
  added: boolean;
  type: ReactionType;
  reactions: { type: ReactionType; count: number }[];
}

export const reactionsApi = {
  async toggle(postId: string | number, type: ReactionType): Promise<ToggleReactionResponse> {
    return apiFetch<ToggleReactionResponse>(`/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  async getCounts(postId: string | number): Promise<ReactionCount[]> {
    const data = await apiFetch<{ reactions: ReactionCount[] }>(`/posts/${postId}/reactions`);
    return data.reactions;
  },
};

// ============================================================
// COMMENTS
// ============================================================

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  post_id: number;
  is_own: boolean;
  author: {
    id: string;
    username: string;
    avatar: string;
  };
}

export interface CommentsMeta {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export const commentsApi = {
  async list(postId: string | number, page = 1, perPage = 20): Promise<{ comments: Comment[]; meta: CommentsMeta }> {
    return apiFetch(`/posts/${postId}/comments?page=${page}&per_page=${perPage}`);
  },

  async create(postId: string | number, content: string): Promise<Comment> {
    return apiFetch(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async update(commentId: number, content: string): Promise<Comment> {
    return apiFetch(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  async delete(commentId: number): Promise<void> {
    return apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
  },
};

// ============================================================
// BOARDS
// ============================================================

export const boardsApi = {
  async getAll(limit = 10): Promise<Board[]> {
    const data = await apiFetch<{ boards: Board[] }>(`/boards?limit=${limit}`);
    return data.boards;
  },

  async getByUser(username: string): Promise<Board[]> {
    const data = await apiFetch<{ boards: Board[] }>(`/users/${username}/boards`);
    return data.boards;
  },

  async create(data: {
    name: string;
    description?: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<Board> {
    return apiFetch('/boards', { method: 'POST', body: JSON.stringify(data) });
  },

  async follow(boardId: string): Promise<{ isFollowing: boolean; followers: number }> {
    return apiFetch(`/boards/${boardId}/follow`, { method: 'POST' });
  },

  async unfollow(boardId: string): Promise<{ isFollowing: boolean; followers: number }> {
    return apiFetch(`/boards/${boardId}/unfollow`, { method: 'POST' });
  },
};

// ============================================================
// USERS / SEARCH / PROFILE
// ============================================================

export interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  followersCount: number;
  isFollowing: boolean;
}

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
}

export const usersApi = {
  /** Публичный профиль по username */
  async getProfile(username: string): Promise<UserProfile> {
    return apiFetch<UserProfile>(`/users/${username}`);
  },

  /** Публичный профиль по числовому ID */
  async getProfileById(userId: number | string): Promise<UserProfile> {
    return apiFetch<UserProfile>(`/users/${userId}`);
  },

  /**
   * GET /api/users/me — полный профиль текущего пользователя.
   * Требует JWT-токена.
   */
  async getMe(): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me');
  },

  /**
   * PUT /api/users/me — обновление username и/или bio.
   * Требует JWT-токена.
   */
  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/users/me/avatar — загрузка / смена аватара (multipart).
   * Требует JWT-токена. Ограничение: 5 МБ, jpg/jpeg/png/gif/webp.
   */
  async uploadAvatar(file: File): Promise<{ ok: boolean; avatar_url: string }> {
    const token = tokenStorage.getAccess();
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch(`${BASE_URL}/users/me/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Ошибка ${res.status}`);
    }
    return res.json();
  },

  /** DELETE /api/users/me/avatar — сброс аватара на дефолтный */
  async removeAvatar(): Promise<{ ok: boolean; avatar_url: string }> {
    return apiFetch('/users/me/avatar', { method: 'DELETE' });
  },

  async getFollowers(
    username: string,
    page = 1
  ): Promise<{ users: SearchUser[]; total: number; has_more: boolean }> {
    return apiFetch(`/users/${username}/followers?page=${page}&per_page=20`);
  },

  async getFollowing(
    username: string,
    page = 1
  ): Promise<{ users: SearchUser[]; total: number; has_more: boolean }> {
    return apiFetch(`/users/${username}/following?page=${page}&per_page=20`);
  },

  async search(q: string): Promise<SearchUser[]> {
    if (!q.trim()) return [];
    try {
      const data = await apiFetch<{ users: SearchUser[] }>(`/users/search?q=${encodeURIComponent(q)}`);
      return data.users;
    } catch {
      return [];
    }
  },

  async follow(username: string): Promise<{ ok: boolean; isFollowing: boolean; followers: number }> {
    return apiFetch(`/users/${username}/follow`, { method: 'POST' });
  },

  async unfollow(username: string): Promise<{ ok: boolean; isFollowing: boolean; followers: number }> {
    return apiFetch(`/users/${username}/unfollow`, { method: 'POST' });
  },
};