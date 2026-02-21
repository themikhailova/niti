import { useState } from 'react';
import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import type { Post } from '@/types';
import { getAvatarUrl, formatRelativeDate } from '@/utils/helpers';
import { api } from '@/api/client';

interface PostCardProps {
  post: Post;
  onDelete?: (id: number) => void;
}

export function PostCard({ post, onDelete }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Удалить пост?')) return;
    setDeleting(true);
    try {
      await api.deletePost(post.id);
      onDelete?.(post.id);
    } catch {
      alert('Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="bg-card border border-border rounded-xl p-5 hover:border-ring/30 transition-colors">
      <div className="flex items-start gap-3">
        <Link to={`/profile/${post.author.username}`} className="shrink-0">
          <img
            src={getAvatarUrl(post.author.username, post.author.avatar)}
            alt={post.author.username}
            className="w-9 h-9 rounded-full object-cover"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <Link
              to={`/profile/${post.author.username}`}
              className="font-medium text-foreground hover:underline"
            >
              {post.author.username}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(post.created_at)}
            </span>
          </div>

          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>

        {post.is_own && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition disabled:opacity-40"
            title="Удалить пост"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </article>
  );
}
