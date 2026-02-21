import { useState, useEffect, useCallback } from 'react';
import { Shuffle, Sparkles, Clock, BookOpen } from 'lucide-react';
import { api } from '@/api/client';
import type { Post, FeedMode } from '@/types';
import { PostCard } from '@/components/PostCard';
import { ComposePost } from '@/components/ComposePost';

const MODES: { value: FeedMode; label: string; icon: React.ReactNode }[] = [
  { value: 'balanced', label: 'Для вас', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { value: 'interests', label: 'Интересы', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { value: 'content', label: 'Похожее', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'serendipity', label: 'Случайное', icon: <Shuffle className="w-3.5 h-3.5" /> },
];

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<FeedMode>('balanced');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = useCallback(async (selectedMode: FeedMode, pageNum: number, append = false) => {
    try {
      const data = await api.getFeed({ page: pageNum, mode: selectedMode });
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.has_more);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить ленту');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadFeed(mode, 1).finally(() => setLoading(false));
  }, [mode, loadFeed]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await loadFeed(mode, next, true);
    setLoadingMore(false);
  };

  const handlePosted = (post: Post) => {
    setPosts(prev => [post, ...prev]);
  };

  const handleDelete = (id: number) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              mode === m.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Compose */}
      <ComposePost onPosted={handlePosted} />

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{error}</p>
          <button onClick={() => loadFeed(mode, 1)} className="mt-2 text-sm underline">
            Попробовать снова
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-1">Пока пусто</p>
          <p className="text-sm">Подпишитесь на авторов, чтобы видеть их посты</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition disabled:opacity-50"
          >
            {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        </div>
      )}
    </main>
  );
}
