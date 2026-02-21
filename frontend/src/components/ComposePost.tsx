import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { getAvatarUrl } from '@/utils/helpers';
import type { Post } from '@/types';

interface ComposePostProps {
  onPosted: (post: Post) => void;
}

export function ComposePost({ onPosted }: ComposePostProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const MAX = 5000;

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    setLoading(true);
    try {
      const post = await api.createPost(content.trim());
      setContent('');
      onPosted(post);
    } catch (err: any) {
      setError(err.message || 'Ошибка при публикации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4">
      <div className="flex gap-3">
        <img
          src={getAvatarUrl(user.username, user.avatar)}
          alt={user.username}
          className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что нового?"
            rows={3}
            maxLength={MAX}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm leading-relaxed"
          />

          {error && (
            <p className="text-xs text-destructive mb-2">{error}</p>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <span className={`text-xs ${content.length > MAX * 0.9 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {content.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {loading ? 'Публикация...' : 'Опубликовать'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
