import React from 'react';
import { X, Heart, Bookmark, Share2, MessageCircle, MoreHorizontal, ArrowLeft, Trash2 } from 'lucide-react';
import type { Post, Board, MoodType } from '../data/mock-data';
import { postsApi, reactionsApi, commentsApi, tokenStorage } from '../services/api';
import type { Comment } from '../services/api';
import { moodConfigs } from '../data/mock-data';

interface PostDetailViewProps {
  post: Post;
  onClose: () => void;
  onBoardClick?: (board: Board | { id: string; name: string }) => void;
  relatedPosts?: Post[];
  onDelete?: (postId: string) => void;
}

export function PostDetailView({ post, onClose, onBoardClick, relatedPosts = [], onDelete }: PostDetailViewProps) {
  const [isSaved, setIsSaved] = React.useState(false);
  const [commentText, setCommentText] = React.useState('');
  const [commentSort, setCommentSort] = React.useState<'top' | 'newest'>('top');
  const [deleting, setDeleting] = React.useState(false);

  // ── Лайк (реальный API) ───────────────────────────────────────────────────
  const [likeCount, setLikeCount] = React.useState(post.engagement.reactions ?? 0);
  const [liked, setLiked] = React.useState(false);
  const [likePending, setLikePending] = React.useState(false);

  // ── Комментарии (реальный API) ────────────────────────────────────────────
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentCount, setCommentCount] = React.useState(post.engagement.comments ?? 0);
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [commentPage, setCommentPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);

  const isLoggedIn = !!tokenStorage.getAccess();
  const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;

  // Загружаем реальный счётчик лайков
  React.useEffect(() => {
    reactionsApi.getCounts(post.id).then((data) => {
      const likeItem = data.find((r) => r.type === 'like');
      if (likeItem) setLikeCount(likeItem.count);
    }).catch(() => {});
  }, [post.id]);

  // Загружаем комментарии
  React.useEffect(() => {
    setCommentLoading(true);
    commentsApi.list(post.id, 1, 20).then((res) => {
      setComments(res.comments);
      setCommentCount(res.meta.total);
      setHasMore(res.meta.has_more);
      setCommentPage(1);
    }).catch(() => {}).finally(() => setCommentLoading(false));
  }, [post.id]);

  const handleDelete = async () => {
    if (!confirm('Удалить пост?')) return;
    setDeleting(true);
    try {
      await postsApi.delete(post.id);
      onDelete?.(post.id);
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при удалении');
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn) { alert('Войдите, чтобы ставить лайки'); return; }
    if (likePending) return;
    setLikePending(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
    try {
      const res = await reactionsApi.toggle(post.id, 'like');
      const serverLike = res.reactions.find((r) => r.type === 'like');
      setLikeCount(serverLike?.count ?? 0);
      setLiked(res.added);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
    } finally {
      setLikePending(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    if (!isLoggedIn) { alert('Войдите, чтобы оставить комментарий'); return; }
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

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Удалить комментарий?')) return;
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при удалении');
    }
  };

  const handleLoadMore = async () => {
    const nextPage = commentPage + 1;
    setCommentLoading(true);
    try {
      const res = await commentsApi.list(post.id, nextPage, 20);
      setComments((prev) => [...prev, ...res.comments]);
      setHasMore(res.meta.has_more);
      setCommentPage(nextPage);
    } catch {
    } finally {
      setCommentLoading(false);
    }
  };

  const sortedComments = React.useMemo(() => {
    if (commentSort === 'newest') {
      return [...comments].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return comments;
  }, [comments, commentSort]);

  const CommentItem = ({ comment }: { comment: Comment }) => (
    <div className="flex gap-3 group">
      <img
        src={comment.author.avatar}
        alt={comment.author.username}
        className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-blue-50"
      />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-lg p-3 mb-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm">
                @{comment.author.username}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(comment.created_at).toLocaleDateString('ru', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            {comment.is_own && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                title="Удалить комментарий"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">{comment.content}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-blue-100/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Назад</span>
            </button>

            <div className="flex items-center gap-2">
              {(post.is_own ?? false) && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-40"
                  title="Удалить пост"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="font-medium hidden sm:inline">
                    {deleting ? 'Удаление...' : 'Удалить'}
                  </span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-blue-100/30">
              {post.content.imageUrl && (
                <div className="relative">
                  <img
                    src={post.content.imageUrl}
                    alt={post.content.title || 'Post'}
                    className="w-full h-auto object-contain max-h-[80vh]"
                  />
                  {postMoodConfig && (
                    <div className="absolute top-4 left-4">
                      <div
                        className={`px-4 py-2 rounded-full backdrop-blur-md shadow-lg border flex items-center gap-2 ${postMoodConfig.borderColor}`}
                        style={{ backgroundColor: `${postMoodConfig.pastelBg}E6` }}
                      >
                        <span className="text-xl">{postMoodConfig.emoji}</span>
                        <span className="font-medium text-sm" style={{ color: postMoodConfig.color }}>
                          {postMoodConfig.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {post.content.text && (
                <div className="p-8">
                  <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                    {post.content.text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* Author Block */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-12 h-12 rounded-full ring-2 ring-blue-100"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{post.author.name}</p>
                      <p className="text-sm text-gray-500">{post.author.username}</p>
                    </div>
                  </div>
                  {!(post.is_own ?? false) && (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                      Подписаться
                    </button>
                  )}
                </div>
                {post.sourceBoard && (
                  <button
                    onClick={() => onBoardClick?.(post.sourceBoard!)}
                    className="flex items-center gap-3 w-full p-4 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100/50"
                  >
                    <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-lg">{post.sourceBoard.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{post.sourceBoard.name}</p>
                      <p className="text-xs text-gray-500">Посмотреть доску</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Post Metadata */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                {post.content.title && (
                  <h1 className="text-2xl font-semibold text-gray-900 mb-3 leading-tight">
                    {post.content.title}
                  </h1>
                )}
                {post.content.caption && (
                  <p className="text-gray-700 leading-relaxed mb-4">{post.content.caption}</p>
                )}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500">{post.timestamp}</p>
              </div>

              {/* Engagement Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                <div className="grid grid-cols-3 gap-3">
                  {/* Лайк — реальный API */}
                  <button
                    onClick={handleLike}
                    disabled={likePending}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                      liked
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Heart
                      className="w-6 h-6 transition-all duration-150"
                      fill={liked ? 'currentColor' : 'none'}
                      strokeWidth={liked ? 0 : 2}
                    />
                    <p className="text-sm font-medium">{likeCount}</p>
                  </button>

                  <button
                    onClick={() => setIsSaved(!isSaved)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                      isSaved ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} />
                    <p className="text-sm font-medium">{post.engagement.saves + (isSaved ? 1 : 0)}</p>
                  </button>

                  <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                    <Share2 className="w-6 h-6" />
                    <p className="text-sm font-medium">{post.engagement.shares ?? 0}</p>
                  </button>
                </div>
              </div>

              {/* Comments Section — реальный API */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">
                      Комментарии ({commentCount})
                    </h3>
                  </div>
                  <select
                    value={commentSort}
                    onChange={(e) => setCommentSort(e.target.value as 'top' | 'newest')}
                    className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="top">Сначала старые</option>
                    <option value="newest">Сначала новые</option>
                  </select>
                </div>

                {/* Add Comment */}
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={isLoggedIn ? 'Написать комментарий...' : 'Войдите, чтобы оставить комментарий'}
                        rows={3}
                        disabled={!isLoggedIn || commentLoading}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          type="submit"
                          disabled={!commentText.trim() || !isLoggedIn || commentLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {commentLoading ? 'Отправка...' : 'Отправить'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Comment List */}
                <div className="space-y-4">
                  {commentLoading && comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Загрузка комментариев...</p>
                  ) : sortedComments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Пока нет комментариев. Будьте первым!</p>
                  ) : (
                    sortedComments.map((comment) => (
                      <CommentItem key={comment.id} comment={comment} />
                    ))
                  )}
                </div>

                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    disabled={commentLoading}
                    className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    {commentLoading ? 'Загрузка...' : 'Загрузить ещё'}
                  </button>
                )}
              </div>

              {/* Related Content */}
              {relatedPosts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Больше похожего
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      Из {post.sourceBoard?.name || 'этой доски'}
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {relatedPosts.slice(0, 4).map((relatedPost) => {
                      const relatedMoodConfig = relatedPost.mood ? moodConfigs[relatedPost.mood] : null;
                      return (
                        <div
                          key={relatedPost.id}
                          className="rounded-lg overflow-hidden cursor-pointer group border border-gray-200 hover:shadow-md transition-all"
                          style={{ backgroundColor: relatedMoodConfig?.pastelBg || '#ffffff' }}
                        >
                          {relatedPost.content.imageUrl ? (
                            <div className="relative aspect-square overflow-hidden">
                              <img
                                src={relatedPost.content.imageUrl}
                                alt={relatedPost.content.title || 'Related post'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="aspect-square p-3 flex flex-col justify-center">
                              {relatedMoodConfig && <span className="text-2xl mb-2">{relatedMoodConfig.emoji}</span>}
                              <p className="text-xs font-medium text-gray-900 line-clamp-3">
                                {relatedPost.content.title || relatedPost.content.text}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}