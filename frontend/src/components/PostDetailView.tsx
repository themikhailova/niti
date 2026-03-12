import React from 'react';
import { X, Heart, Bookmark, Share2, MessageCircle, MoreHorizontal, ArrowLeft, ChevronDown, Trash2 } from 'lucide-react';
import type { Post, Board, MoodType } from '../data/mock-data';
import { postsApi } from '../services/api';
import { moodConfigs } from '../data/mock-data';

interface Comment {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
}

interface PostDetailViewProps {
  post: Post;
  onClose: () => void;
  onBoardClick?: (board: Board | { id: string; name: string }) => void;
  relatedPosts?: Post[];
  onDelete?: (postId: string) => void;
}

export function PostDetailView({ post, onClose, onBoardClick, relatedPosts = [], onDelete }: PostDetailViewProps) {
  const [isLiked, setIsLiked] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [commentText, setCommentText] = React.useState('');
  const [commentSort, setCommentSort] = React.useState<'top' | 'newest'>('top');
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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

  const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;

  // Mock comments data
  const mockComments: Comment[] = [
    {
      id: '1',
      author: {
        name: 'Elena Rodriguez',
        username: '@elenarod',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
      },
      content: 'This is absolutely stunning! The composition and color palette work so well together. Thanks for sharing this inspiration.',
      timestamp: '2h ago',
      likes: 24,
      replies: [
        {
          id: '1-1',
          author: {
            name: post.author.name,
            username: post.author.username,
            avatar: post.author.avatar,
          },
          content: 'Thank you so much! I\'m glad you found it inspiring 💙',
          timestamp: '1h ago',
          likes: 8,
        },
      ],
    },
    {
      id: '2',
      author: {
        name: 'Marcus Chen',
        username: '@marcusc',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
      },
      content: 'Saved to my design references board. The use of negative space here is masterful.',
      timestamp: '4h ago',
      likes: 15,
    },
    {
      id: '3',
      author: {
        name: 'Sophia Anderson',
        username: '@sophiaa',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
      },
      content: 'Would love to know more about the creative process behind this!',
      timestamp: '6h ago',
      likes: 9,
    },
  ];

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      console.log('Posting comment:', commentText);
      setCommentText('');
      setReplyingTo(null);
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-12' : ''}`}>
      <div className="flex gap-3 group">
        <img
          src={comment.author.avatar}
          alt={comment.author.name}
          className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-blue-50"
        />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900 text-sm">
                {comment.author.name}
              </span>
              <span className="text-xs text-gray-500">{comment.author.username}</span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500">{comment.timestamp}</span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">{comment.content}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <button className="hover:text-red-500 transition-colors flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              <span>{comment.likes}</span>
            </button>
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="hover:text-blue-600 transition-colors"
            >
              Ответить
            </button>
          </div>
          
          {/* Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} isReply />
              ))}
            </div>
          )}
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
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-600" />
              </button>
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
          {/* Left Column - Main Content (60-70%) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-blue-100/30">
              {/* Image Content */}
              {post.content.imageUrl && (
                <div className="relative">
                  <img
                    src={post.content.imageUrl}
                    alt={post.content.title || 'Post'}
                    className="w-full h-auto object-contain max-h-[80vh]"
                  />
                  
                  {/* Mood Badge Overlay */}
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

              {/* Text Content */}
              {post.content.text && (
                <div className="p-8">
                  <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                    {post.content.text}
                  </p>
                </div>
              )}

              {/* Link Preview */}
              {post.content.linkUrl && (
                <div className="p-6 border-t border-blue-50">
                  <a
                    href={post.content.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-1">
                      {post.content.linkTitle || 'External Link'}
                    </p>
                    <p className="text-gray-500 text-xs truncate">{post.content.linkUrl}</p>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata & Engagement (30-40%) */}
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

                {/* Board Link */}
                {post.sourceBoard && (
                  <button
                    onClick={() => {
                      onBoardClick?.(post.sourceBoard!);
                    }}
                    className="flex items-center gap-3 w-full p-4 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100/50"
                  >
                    <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-lg">
                        {post.sourceBoard.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.sourceBoard.name}
                      </p>
                      <p className="text-xs text-gray-500">Посмотреть доску</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Post Metadata */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                {/* Title */}
                {post.content.title && (
                  <h1 className="text-2xl font-semibold text-gray-900 mb-3 leading-tight">
                    {post.content.title}
                  </h1>
                )}

                {/* Caption */}
                {post.content.caption && (
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {post.content.caption}
                  </p>
                )}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-sm text-gray-500">{post.timestamp}</p>
              </div>

              {/* Engagement Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                      isLiked
                        ? 'bg-red-50 text-red-600'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Heart
                      className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`}
                    />
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {post.engagement.reactions + (isLiked ? 1 : 0)}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsSaved(!isSaved)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                      isSaved
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Bookmark
                      className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`}
                    />
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {post.engagement.saves + (isSaved ? 1 : 0)}
                      </p>
                    </div>
                  </button>

                  <button className="flex flex-col items-center gap-2 p-4 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                    <Share2 className="w-6 h-6" />
                    <div className="text-center">
                      <p className="text-sm font-medium">{post.engagement.shares}</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Comments Section */}
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">
                      Комментарии ({post.engagement.comments})
                    </h3>
                  </div>
                  
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <select
                      value={commentSort}
                      onChange={(e) => setCommentSort(e.target.value as 'top' | 'newest')}
                      className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="top">Топ</option>
                      <option value="newest">Недавние</option>
                    </select>
                  </div>
                </div>

                {/* Add Comment */}
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <div className="flex gap-3">
                    <img
                      src={post.author.avatar}
                      alt="Your avatar"
                      className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-blue-100"
                    />
                    <div className="flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={replyingTo ? 'Write a reply...' : 'Add a thoughtful comment...'}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        {replyingTo && (
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Отменить
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={!commentText.trim()}
                          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Отправить
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Comment Thread */}
                <div className="space-y-4">
                  {mockComments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                </div>
              </div>

              {/* Related Content */}
              {relatedPosts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-blue-100/30 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>Больше похожего</span>
                    <span className="text-xs text-gray-500 font-normal">
                      Из {post.sourceBoard?.name || 'этой доски'}
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
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
                              {relatedMoodConfig && (
                                <div className="absolute top-2 left-2">
                                  <span className="text-lg drop-shadow-md">{relatedMoodConfig.emoji}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="aspect-square p-3 flex flex-col justify-center">
                              {relatedMoodConfig && (
                                <span className="text-2xl mb-2">{relatedMoodConfig.emoji}</span>
                              )}
                              <p className="text-xs font-medium text-gray-900 line-clamp-3">
                                {relatedPost.content.title || relatedPost.content.text}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Related Boards Section */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-medium text-gray-900 text-sm mb-3">Похожие доски</h4>
                    <div className="space-y-2">
                      {/* Mock related boards - in real app would come from props */}
                      {[
                        { id: 'b1', name: 'Similar Inspirations', followers: 8500 },
                        { id: 'b2', name: 'Creative Collection', followers: 12300 },
                      ].map((board) => (
                        <button
                          key={board.id}
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-bold text-sm">
                                {board.name.charAt(0)}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-gray-900">{board.name}</p>
                              <p className="text-xs text-gray-500">{(board.followers / 1000).toFixed(1)}k подписчиков</p>
                            </div>
                          </div>
                          <span className="text-blue-600 text-sm font-medium">Посмотреть</span>
                        </button>
                      ))}
                    </div>
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