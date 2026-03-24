import React from 'react';
import { Users } from 'lucide-react';
import type { Board } from '../data/mock-data';

interface BoardTileProps {
  board: Board;
  onClick?: () => void;
}

export function BoardTile({ board, onClick }: BoardTileProps) {
  return (
    <div className="flex-shrink-0 w-56 cursor-pointer group" onClick={onClick}>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-blue-200 transition-all duration-200">
        {/* Board Cover */}
        <div className="relative h-32 overflow-hidden">
          <img
            src={board.coverImage}
            alt={board.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          {/* Post Count Badge */}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded text-xs font-medium text-gray-700">
            {board.postCount} постов
          </div>
        </div>
        
        {/* Board Info */}
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
            {board.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            <span>{(board.followers).toFixed(1)} подписчиков</span>
          </div>
        </div>
      </div>
    </div>
  );
}