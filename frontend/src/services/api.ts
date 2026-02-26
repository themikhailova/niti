// ============================================================
// API SERVICE — подключается к Flask бэкенду
// При недоступности бэкенда автоматически использует mock-данные
// ============================================================

import { mockPosts, mockBoards, mockUserProfile } from '../data/mock-data';
import type { Post, Board, UserProfile } from '../data/mock-data';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  bio?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

export const authApi = {
  async login(data: { username: string; password: string }): Promise<AuthUser> {
    return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  },
  async register(data: { username: string; password: string }): Promise<AuthUser> {
    return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  },
  async logout(): Promise<void> {
    return apiFetch('/auth/logout', { method: 'POST' });
  },
  async me(): Promise<AuthUser | null> {
    try { return await apiFetch('/auth/me'); } catch { return null; }
  },
};

// ============================================================
// POSTS
// ============================================================

export const postsApi = {
  async getFeed(page = 1): Promise<Post[]> {
    try {
      const data = await apiFetch<{ posts: Post[] }>(`/posts/feed?page=${page}`);
      return data.posts;
    } catch {
      console.warn('[API] getFeed: mock-данные');
      return mockPosts;
    }
  },

  async create(payload: {
    content?: string;
    title?: string;
    imageUrl?: string;
    postType?: string;
    boardId?: string;
  }): Promise<Post> {
    return apiFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
  },

  async delete(postId: string): Promise<void> {
    return apiFetch(`/posts/${postId}`, { method: 'DELETE' });
  },

  async getUserPosts(username: string): Promise<Post[]> {
    try {
      const data = await apiFetch<{ posts: Post[] }>(`/users/${username}/posts`);
      return data.posts;
    } catch {
      return mockPosts.filter(p => p.author.username === username);
    }
  },
};

// ============================================================
// BOARDS
// ============================================================

export const boardsApi = {
  async getAll(limit = 10): Promise<Board[]> {
    try {
      const data = await apiFetch<{ boards: Board[] }>(`/boards?limit=${limit}`);
      return data.boards;
    } catch {
      console.warn('[API] getAll boards: mock-данные');
      return mockBoards;
    }
  },

  async getByUser(username: string): Promise<Board[]> {
    try {
      const data = await apiFetch<{ boards: Board[] }>(`/users/${username}/boards`);
      return data.boards;
    } catch {
      return mockBoards.slice(0, 4);
    }
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
    try {
      return await apiFetch(`/boards/${boardId}/follow`, { method: 'POST' });
    } catch {
      return { isFollowing: true, followers: 0 };
    }
  },

  async unfollow(boardId: string): Promise<{ isFollowing: boolean; followers: number }> {
    try {
      return await apiFetch(`/boards/${boardId}/unfollow`, { method: 'POST' });
    } catch {
      return { isFollowing: false, followers: 0 };
    }
  },
};

// ============================================================
// USERS / SEARCH
// ============================================================

export interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  followersCount: number;
  isFollowing: boolean;
}

export const usersApi = {
  async getProfile(username: string): Promise<UserProfile> {
    try {
      return await apiFetch<UserProfile>(`/users/${username}`);
    } catch {
      return mockUserProfile;
    }
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
      body: data,
    });
    if (!res.ok) throw new Error('Ошибка обновления профиля');
    return res.json();
  },
};
