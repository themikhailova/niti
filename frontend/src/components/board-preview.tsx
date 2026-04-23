import React from 'react';
import { Users, Plus, Check } from 'lucide-react';
import type { Board } from '../data/mock-data';

interface BoardPreviewProps {
  board: Board;
  onFollow?: (boardId: string) => void;
  onClick?: () => void;
}

export function BoardPreview({ board, onFollow, onClick }: BoardPreviewProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  
  // Проверяем, есть ли обложка
  const hasCover = board.coverImage && board.coverImage.trim() !== '';

  return (
    <div
      className="bg-white/60 backdrop-blur-sm rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-300 cursor-pointer group border border-blue-100/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Cover Image - показываем только если есть обложка */}
      {hasCover && (
        <div className="relative overflow-hidden">
          <img
            src={board.coverImage}
            alt={board.name}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
            style={{ aspectRatio: '16/9' }} // Сохраняем пропорции, но не фиксируем высоту
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Hover Actions */}
          {isHovered && (
            <div className="absolute bottom-3 right-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFollow?.(board.id);
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                  board.isFollowing
                    ? 'bg-white/90 text-blue-700 hover:bg-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {board.isFollowing ? (
                  <>
                    <Check className="w-4 h-4" />
                    Подписан
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Подписаться
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Board Info - отступы уменьшаем если нет обложки */}
      <div className={`p-4 ${!hasCover ? 'pt-4' : ''}`}>
        <h3 className="font-semibold text-gray-800 mb-2 leading-tight">
          {board.name}
        </h3>
        
        <p className="text-sm text-gray-600/80 mb-3 line-clamp-2">
          {board.description}
        </p>

        {/* Tags */}
        {board.tags && board.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {board.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-700/80 rounded text-xs font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500/80 pt-3 border-t border-blue-100/50">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{Math.round(Number(board.followers) || 0)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{Math.round(Number(board.postCount) || 0)} постов</span>
            <span className="text-blue-300/60">•</span>
            <span>{board.collaborators} соавторов</span>
          </div>
        </div>
      </div>
    </div>
  );
}