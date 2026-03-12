import React from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Users, Trash2 } from 'lucide-react';
import type { Post } from '../data/mock-data';
import { moodConfigs } from '../data/mock-data';
import { postsApi } from '../services/api';

interface PostCardProps {
  post: Post;
  onClick?: () => void;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onClick, onDelete }: PostCardProps) {
  const { author, sourceBoard, content, engagement, timestamp, mood } = post;
  const moodConfig = mood ? moodConfigs[mood] : null;
  const [deleting, setDeleting] = React.useState(false);

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

  return (
    <article 
      className="rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 mb-8 border border-gray-200/50 cursor-pointer"
      style={{ backgroundColor: moodConfig ? moodConfig.pastelBg : '#ffffff' }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={author.avatar}
              alt={author.name}
              className="w-10 h-10 rounded-full ring-2 ring-white/80"
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
                style={{ 
                  color: moodConfig.color,
                  borderColor: moodConfig.color + '30'
                }}
                title={moodConfig.description}
              >
                <span className="text-base">{moodConfig.emoji}</span>
                <span>{moodConfig.label}</span>
              </div>
            )}
            {/* Кнопка удаления — только для своих постов */}
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

      {/* Content */}
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

        {/* Engagement Row */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-blue-50">
          <div className="flex items-center gap-6">
            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors group"
            >
              <Heart className="w-5 h-5 group-hover:fill-blue-600" />
              <span className="text-sm font-medium">{engagement.reactions}</span>
            </button>
            
            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{engagement.comments}</span>
            </button>

            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-sm font-medium">{engagement.saves}</span>
          </button>
        </div>
      </div>
    </article>
  );
}