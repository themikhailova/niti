export interface User {
  id: number;
  username: string;
  avatar: string | null;
  interests: string[];
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at?: string;
  is_following?: boolean;
  is_own?: boolean;
}

export interface Post {
  id: number;
  content: string;
  created_at: string;
  author: {
    id: number;
    username: string;
    avatar: string | null;
  };
  is_own?: boolean;
}

export interface FeedResponse {
  posts: Post[];
  page: number;
  has_more: boolean;
  total: number;
}

export interface ProfileResponse {
  user: User;
  posts: ProfilePost[];
  page: number;
  has_more: boolean;
}

export interface ProfilePost {
  id: number;
  content: string;
  created_at: string;
  is_own: boolean;
}

export interface SearchResponse {
  users: SearchUser[];
  popular_users: SearchUser[];
  query: string;
  page?: number;
  has_more?: boolean;
}

export interface SearchUser {
  id: number;
  username: string;
  avatar: string | null;
  followers_count: number;
  posts_count: number;
  interests: string[];
}

export type FeedMode = 'balanced' | 'interests' | 'content' | 'serendipity';
