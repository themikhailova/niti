// ============================================================
// API SERVICE — подключается к Flask бэкенду
// ============================================================

import type { Post, Board, UserProfile } from '../data/mock-data';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── Хранилище токенов ────────────────────────────────────────────────────────

const TOKEN_KEY   = 'access_token';
const REFRESH_KEY = 'refresh_token';

export const tokenStorage = {
  getAccess:  () => localStorage.getItem(TOKEN_KEY),
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

// ── Авто-refresh токена ───────────────────────────────────────────────────────

let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

async function _doRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshToken}` },
  });

  if (!res.ok) {
    tokenStorage.clear();
    window.location.href = '/login';
    return null;
  }

  const data = await res.json();
  tokenStorage.save(
    data.access_token,
    data.refresh_token ?? refreshToken,
  );
  return data.access_token as string;
}

// ── Базовый fetch: Bearer-токен + JSON + авто-refresh ────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });

  let res = await makeRequest(tokenStorage.getAccess());

  // ── 401: пробуем refresh ──────────────────────────────────────────────────
  if (res.status === 401) {
    if (_isRefreshing) {
      const newToken = await new Promise<string>((resolve) => {
        _refreshQueue.push(resolve);
      });
      res = await makeRequest(newToken);
    } else {
      _isRefreshing = true;
      const newToken = await _doRefresh();
      _isRefreshing = false;

      if (newToken) {
        _refreshQueue.forEach((cb) => cb(newToken));
        _refreshQueue = [];
        res = await makeRequest(newToken);
      } else {
        _refreshQueue = [];
      }
    }
  }

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
    return apiFetch('/posts/', { method: 'POST', body: JSON.stringify(payload) });
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

  /**
   * POST /api/posts/<id>/save — toggle сохранения поста.
   * Возвращает { saved: boolean, saves_count: number }
   */
  async savePost(postId: string | number): Promise<{ saved: boolean; saves_count: number }> {
    return apiFetch(`/posts/${postId}/save`, { method: 'POST' });
  },

  /**
   * GET /api/posts/saved — список сохранённых постов текущего пользователя.
   * Возвращает { posts: Post[], total: number, has_more: boolean }
   */
  async getMySavedPosts(page = 1): Promise<{ posts: Post[]; total: number; has_more: boolean }> {
    return apiFetch(`/posts/saved?page=${page}`);
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
  /** Все публичные доски (старый, обратная совместимость) */
  async getAll(limit = 10): Promise<Board[]> {
    const data = await apiFetch<{ boards: Board[] }>(`/boards?limit=${limit}`);
    return data.boards;
  },

  /**
   * GET /api/boards/recommended — персональные рекомендации (левая колонка).
   * Для гостей возвращает trending.
   */
  async getRecommended(limit = 6): Promise<Board[]> {
    const data = await apiFetch<{ boards: Board[] }>(`/boards/recommended?limit=${limit}`);
    return data.boards;
  },

  /**
   * GET /api/boards/trending — глобальный тренд (правая колонка).
   * Popularity + momentum + freshness. Не зависит от пользователя.
   */
  async getTrending(limit = 6): Promise<Board[]> {
    const data = await apiFetch<{ boards: Board[] }>(`/boards/trending?limit=${limit}`);
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
    coverImage?: string;
    post_ids?: number[];
  }): Promise<Board> {
    return apiFetch('/boards/', { method: 'POST', body: JSON.stringify(data) });
  },

  /** PUT /api/boards/<id> — обновить доску, в т.ч. список постов */
  async update(boardId: string | number, data: {
    name?: string;
    description?: string;
    tags?: string[];
    isPublic?: boolean;
    coverImage?: string;
    post_ids?: number[];
  }): Promise<Board> {
    return apiFetch(`/boards/${boardId}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  /** DELETE /api/boards/<id> — удалить доску */
  async delete(boardId: string | number): Promise<{ ok: boolean; unlinked_posts: number }> {
    return apiFetch(`/boards/${boardId}`, { method: 'DELETE' });
  },

  /** POST /api/boards/<id>/posts — добавить один пост в доску */
  async addPost(boardId: string | number, postId: string | number): Promise<{ ok: boolean }> {
    return apiFetch(`/boards/${boardId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ post_id: Number(postId) }),
    });
  },

  /** DELETE /api/boards/<id>/posts/<postId> — убрать пост из доски */
  async removePost(boardId: string | number, postId: string | number): Promise<{ ok: boolean }> {
    return apiFetch(`/boards/${boardId}/posts/${postId}`, { method: 'DELETE' });
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
  async getProfile(username: string): Promise<UserProfile> {
    return apiFetch<UserProfile>(`/users/${username}`);
  },

  async getProfileById(userId: number | string): Promise<UserProfile> {
    return apiFetch<UserProfile>(`/users/${userId}`);
  },

  async getMe(): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me');
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

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

// ============================================================
// SAVES (закладки)
// ============================================================

export interface SaveToggleResponse {
  saved:       boolean;
  saves_count: number;
}

export interface SavesCountResponse {
  saves_count: number;
  is_saved:    boolean;
}

export const savesApi = {
  /**
   * POST /api/posts/<id>/save — toggle закладки.
   * Если уже сохранён → убирает, иначе → сохраняет.
   */
  async toggle(postId: string | number): Promise<SaveToggleResponse> {
    return apiFetch<SaveToggleResponse>(`/posts/${postId}/save`, { method: 'POST' });
  },

  /** GET /api/posts/<id>/saves/count — счётчик + флаг is_saved */
  async getCount(postId: string | number): Promise<SavesCountResponse> {
    return apiFetch<SavesCountResponse>(`/posts/${postId}/saves/count`);
  },

  /** GET /api/posts/saved — список сохранённых постов текущего пользователя */
  async getMySaved(page = 1): Promise<{ posts: Post[]; total: number; has_more: boolean }> {
    return apiFetch(`/posts/saved?page=${page}`);
  },
};

// ============================================================
// REPOSTS
// ============================================================

export interface RepostToggleResponse {
  reposted:      boolean;
  reposts_count: number;
}

export interface RepostsCountResponse {
  reposts_count: number;
  is_reposted:   boolean;
}

export const repostsApi = {
  /**
   * POST /api/posts/<id>/repost — toggle репоста.
   * comment — опциональный текст к репосту (макс. 500 символов).
   */
  async toggle(
    postId: string | number,
    comment?: string,
  ): Promise<RepostToggleResponse> {
    return apiFetch<RepostToggleResponse>(`/posts/${postId}/repost`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment ?? '' }),
    });
  },

  /** GET /api/posts/<id>/reposts/count — счётчик + флаг is_reposted */
  async getCount(postId: string | number): Promise<RepostsCountResponse> {
    return apiFetch<RepostsCountResponse>(`/posts/${postId}/reposts/count`);
  },

  /** GET /api/posts/reposted — список репостов текущего пользователя */
  async getMyReposts(page = 1): Promise<{ posts: Post[]; total: number; has_more: boolean }> {
    return apiFetch(`/posts/reposted?page=${page}`);
  },
};