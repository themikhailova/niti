import React from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Users } from 'lucide-react';
import type { Post } from '../data/mock-data';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { author, sourceBoard, content, engagement, timestamp } = post;

  return (
    <article className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 mb-8 border border-gray-100">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={author.avatar}
              alt={author.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-medium text-gray-900">{author.name}</p>
              <p className="text-sm text-gray-500">{timestamp}</p>
            </div>
          </div>
          {sourceBoard && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full text-sm text-blue-700">
              <Users className="w-3.5 h-3.5" />
              <span>From board: {sourceBoard.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {content.imageUrl && (
        <div className="w-full">
          <img
            src={content.imageUrl}
            alt={content.title || 'Post image'}
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
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors group">
              <Heart className="w-5 h-5 group-hover:fill-blue-600" />
              <span className="text-sm font-medium">{engagement.reactions}</span>
            </button>
            
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{engagement.comments}</span>
            </button>

            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Bookmark className="w-4 h-4" />
            <span className="text-sm font-medium">{engagement.saves}</span>
          </button>
        </div>
      </div>
    </article>
  );
}