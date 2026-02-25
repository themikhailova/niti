// ============================================================
// API SERVICE — подключается к Flask бэкенду
// При недоступности бэкенда автоматически использует mock-данные
// ============================================================

import { mockPosts, mockBoards, mockUserProfile } from '../data/mock-data';
import type { Post, Board, UserProfile } from '../data/mock-data';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Настройки fetch с credentials (для сессий Flask)
const fetchOptions: RequestInit = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    ...options,
    headers: { ...fetchOptions.headers, ...(options?.headers ?? {}) },
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
  avatar: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

export interface LoginPayload { username: string; password: string }
export interface RegisterPayload { username: string; password: string }

export const authApi = {
  async login(data: LoginPayload): Promise<AuthUser> {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async register(data: RegisterPayload): Promise<AuthUser> {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<void> {
    return apiFetch('/auth/logout', { method: 'POST' });
  },

  async me(): Promise<AuthUser | null> {
    try {
      return await apiFetch('/auth/me');
    } catch {
      return null;
    }
  },
};

// ============================================================
// POSTS
// ============================================================

export const postsApi = {
  /** Лента постов текущего пользователя */
  async getFeed(page = 1): Promise<Post[]> {
    try {
      const data = await apiFetch<{ posts: Post[] }>(`/posts/feed?page=${page}`);
      return data.posts;
    } catch {
      console.warn('[API] getFeed: используем mock-данные');
      return mockPosts;
    }
  },

  /** Создать пост */
  async create(content: string): Promise<Post> {
    return apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  /** Посты конкретного пользователя */
  async getUserPosts(username: string): Promise<Post[]> {
    try {
      const data = await apiFetch<{ posts: Post[] }>(`/users/${username}/posts`);
      return data.posts;
    } catch {
      console.warn('[API] getUserPosts: используем mock-данные');
      return mockPosts.filter(p => p.author.username === username);
    }
  },
};

// ============================================================
// BOARDS (пока mock — модель Board в бэкенде не реализована)
// ============================================================

export const boardsApi = {
  async getAll(): Promise<Board[]> {
    try {
      const data = await apiFetch<{ boards: Board[] }>('/boards');
      return data.boards;
    } catch {
      console.warn('[API] getAll boards: используем mock-данные');
      return mockBoards;
    }
  },

  async getByUser(username: string): Promise<Board[]> {
    try {
      const data = await apiFetch<{ boards: Board[] }>(`/users/${username}/boards`);
      return data.boards;
    } catch {
      console.warn('[API] getByUser boards: используем mock-данные');
      return mockBoards.slice(0, 4);
    }
  },

  async follow(boardId: string): Promise<void> {
    try {
      await apiFetch(`/boards/${boardId}/follow`, { method: 'POST' });
    } catch {
      console.warn('[API] follow board: mock (no-op)');
    }
  },
};

// ============================================================
// USERS / PROFILE
// ============================================================

export const usersApi = {
  async getProfile(username: string): Promise<UserProfile> {
    try {
      return await apiFetch<UserProfile>(`/users/${username}`);
    } catch {
      console.warn('[API] getProfile: используем mock-данные');
      return mockUserProfile;
    }
  },

  async follow(username: string): Promise<void> {
    return apiFetch(`/users/${username}/follow`, { method: 'POST' });
  },

  async unfollow(username: string): Promise<void> {
    return apiFetch(`/users/${username}/unfollow`, { method: 'POST' });
  },

  async updateProfile(data: FormData): Promise<AuthUser> {
    const res = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      credentials: 'include',
      body: data, // FormData — без Content-Type, браузер выставит сам
    });
    if (!res.ok) throw new Error('Ошибка обновления профиля');
    return res.json();
  },
};
