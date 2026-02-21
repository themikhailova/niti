import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Settings } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { User, ProfilePost } from '@/types';
import { getAvatarUrl, formatRelativeDate } from '@/utils/helpers';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    api.getProfile(username)
      .then(data => {
        setProfile(data.user);
        setPosts(data.posts);
        setHasMore(data.has_more);
      })
      .catch(() => navigate('/feed'))
      .finally(() => setLoading(false));
  }, [username, navigate]);

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (profile.is_following) {
        const res = await api.unfollowUser(profile.username);
        setProfile(p => p ? { ...p, is_following: false, followers_count: res.followers_count } : p);
      } else {
        const res = await api.followUser(profile.username);
        setProfile(p => p ? { ...p, is_following: true, followers_count: res.followers_count } : p);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleDeletePost = (id: number) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    setProfile(p => p ? { ...p, posts_count: Math.max(0, p.posts_count - 1) } : p);
  };

  const loadMore = async () => {
    if (!username) return;
    const next = page + 1;
    const data = await api.getProfile(username, next);
    setPosts(prev => [...prev, ...data.posts]);
    setHasMore(data.has_more);
    setPage(next);
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-muted rounded w-40" />
              <div className="h-3 bg-muted rounded w-60" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const isOwn = currentUser?.username === profile.username;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <img
              src={getAvatarUrl(profile.username, profile.avatar)}
              alt={profile.username}
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{profile.username}</h1>

              {profile.interests && profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.interests.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-5 mt-4 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-foreground">{profile.posts_count}</p>
                  <p className="text-muted-foreground text-xs">постов</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{profile.followers_count}</p>
                  <p className="text-muted-foreground text-xs">подписчиков</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{profile.following_count}</p>
                  <p className="text-muted-foreground text-xs">подписок</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {isOwn ? (
              <Link
                to="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-accent/50 transition"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Редактировать</span>
              </Link>
            ) : (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  profile.is_following
                    ? 'border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                {followLoading ? '...' : profile.is_following ? 'Отписаться' : 'Подписаться'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Постов пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <article key={post.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap break-words flex-1">
                  {post.content}
                </p>
                {post.is_own && (
                  <button
                    onClick={async () => {
                      if (!confirm('Удалить?')) return;
                      await api.deletePost(post.id);
                      handleDeletePost(post.id);
                    }}
                    className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {formatRelativeDate(post.created_at)}
              </p>
            </article>
          ))}

          {hasMore && (
            <div className="text-center">
              <button
                onClick={loadMore}
                className="px-6 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition"
              >
                Загрузить ещё
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
