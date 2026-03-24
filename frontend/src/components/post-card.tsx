import React from 'react';
import { Avatar } from './Avatar';
import { Heart, MessageCircle, Bookmark, Share2, Users, Trash2 } from 'lucide-react';
import type { Post } from '../data/mock-data';
import { moodConfigs } from '../data/mock-data';
import { postsApi, reactionsApi, commentsApi, tokenStorage } from '../services/api';
import type { Comment } from '../services/api';

interface PostCardProps {
  post: Post;
  onClick?: () => void;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onClick, onDelete }: PostCardProps) {
  const { author, sourceBoard, content, engagement, timestamp, mood } = post;
  const moodConfig = mood ? moodConfigs[mood] : null;

  // ── Состояние удаления ─────────────────────────────────────────────────────
  const [deleting, setDeleting] = React.useState(false);

  // ── Состояние лайка ───────────────────────────────────────────────────────
  const [likeCount, setLikeCount] = React.useState(engagement.reactions ?? 0);
  const [liked, setLiked] = React.useState(false);
  const [likePending, setLikePending] = React.useState(false);

  // ── Состояние комментариев ─────────────────────────────────────────────────
  const [showComments, setShowComments] = React.useState(false);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentText, setCommentText] = React.useState('');
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [commentsLoaded, setCommentsLoaded] = React.useState(false);
  const [commentCount, setCommentCount] = React.useState(engagement.comments ?? 0);

  const isLoggedIn = !!tokenStorage.getAccess();

  // Загружаем реальный счётчик лайков при маунте
  React.useEffect(() => {
    reactionsApi.getCounts(post.id).then((data) => {
      const likeItem = data.find((r) => r.type === 'like');
      if (likeItem) setLikeCount(likeItem.count);
    }).catch(() => {});
  }, [post.id]);

  // ── Обработчики ────────────────────────────────────────────────────────────

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить пост?')) return;
    setDeleting(true);
    try {
      await postsApi.delete(post.id);
      onDelete?.(post.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { alert('Войдите, чтобы ставить лайки'); return; }
    if (likePending) return;
    setLikePending(true);

    // Оптимистичное обновление
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);

    try {
      const res = await reactionsApi.toggle(post.id, 'like');
      const serverLike = res.reactions.find((r) => r.type === 'like');
      setLikeCount(serverLike?.count ?? 0);
      setLiked(res.added);
    } catch {
      // Откат
      setLiked(wasLiked);
      setLikeCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
    } finally {
      setLikePending(false);
    }
  };

  const handleToggleComments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments((v) => !v);
    if (!commentsLoaded) {
      setCommentLoading(true);
      try {
        const res = await commentsApi.list(post.id);
        setComments(res.comments);
        setCommentCount(res.meta.total);
        setCommentsLoaded(true);
      } catch {
        // тихая ошибка
      } finally {
        setCommentLoading(false);
      }
    }
  };

  const handleAddComment = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    if (!isLoggedIn) {
      alert('Войдите, чтобы оставить комментарий');
      return;
    }
    setCommentLoading(true);
    try {
      const newComment = await commentsApi.create(post.id, trimmed);
      setComments((prev) => [...prev, newComment]);
      setCommentCount((c) => c + 1);
      setCommentText('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при отправке');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (e: React.MouseEvent, commentId: number) => {
    e.stopPropagation();
    if (!confirm('Удалить комментарий?')) return;
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при удалении');
    }
  };

  return (
    <article
      className="rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 mb-8 border border-gray-200/50"
      style={{ backgroundColor: moodConfig ? moodConfig.pastelBg : '#ffffff' }}
      onClick={onClick}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={author.avatar}
              alt={author.name}
              username={author.name}
              size={40}
              className="ring-2 ring-white/80"
            />
            <div>
              <p className="font-medium text-gray-900">{author.name}</p>
              <p className="text-sm text-gray-600">{timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sourceBoard && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-sm text-blue-700 border border-blue-200/30">
                <Users className="w-3.5 h-3.5" />
                <span>Из доски: {sourceBoard.name}</span>
              </div>
            )}
            {moodConfig && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-sm font-medium border"
                style={{ color: moodConfig.color, borderColor: moodConfig.color + '30' }}
                title={moodConfig.description}
              >
                <span className="text-base">{moodConfig.emoji}</span>
                <span>{moodConfig.label}</span>
              </div>
            )}
            {(post.is_own ?? false) && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                title="Удалить пост"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {content.imageUrl && (
        <div className="w-full">
          <img
            src={content.imageUrl}
            alt={content.title || 'Изображение поста'}
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      <div className="p-6 pt-5">
        {content.title && (
          <h2 className="text-2xl font-semibold text-gray-900 mb-3 leading-tight">
            {content.title}
          </h2>
        )}
        {content.caption && (
          <p className="text-gray-700 leading-relaxed mb-4 whitespace-pre-line">
            {content.caption}
          </p>
        )}
        {content.type === 'text' && content.text && (
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {content.text}
            </p>
          </div>
        )}

        {/* ── Engagement Row ─────────────────────────────────────────────── */}
        <div
          className="mt-6 pt-4 border-t border-blue-50"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">

            {/* Лайк */}
            <button
              onClick={handleLike}
              disabled={likePending}
              className={`flex items-center gap-2 transition-colors group ${
                liked ? 'text-blue-600' : 'text-gray-600 hover:text-blue-500'
              }`}
              title={liked ? 'Убрать лайк' : 'Нравится'}
            >
              <Heart
                className="w-5 h-5 transition-all duration-150 group-hover:scale-110"
                fill={liked ? 'currentColor' : 'none'}
                strokeWidth={liked ? 0 : 2}
              />
              <span className="text-sm font-medium">{likeCount}</span>
            </button>

            {/* Комментарии */}
            <button
              onClick={handleToggleComments}
              className={`flex items-center gap-2 transition-colors ${
                showComments ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{commentCount}</span>
            </button>

            {/* Поделиться */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Сохранить */}
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-sm font-medium">{engagement.saves ?? 0}</span>
          </button>
        </div>
        </div>

        {/* ── Секция комментариев ────────────────────────────────────────── */}
        {showComments && (
          <div className="mt-4 border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
            {/* Список комментариев */}
            {commentLoading && comments.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Загрузка...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Пока нет комментариев. Будьте первым!</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <Avatar
                      src={c.author.avatar}
                      username={c.author.username}
                      size={28}
                      className="mt-0.5"
                    />
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-700">@{c.author.username}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {c.is_own && (
                            <button
                              onClick={(e) => handleDeleteComment(e, c.id)}
                              className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                              title="Удалить комментарий"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Поле ввода комментария */}
            {isLoggedIn ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment(e);
                    }
                  }}
                  placeholder="Написать комментарий..."
                  className="flex-1 text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
                  disabled={commentLoading}
                  maxLength={2000}
                />
                <button
                  onClick={handleAddComment}
                  disabled={commentLoading || !commentText.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {commentLoading ? '...' : 'Отправить'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">
                <span className="text-blue-600 cursor-pointer hover:underline">Войдите</span>, чтобы оставить комментарий
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}