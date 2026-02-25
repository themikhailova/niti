import React from 'react';
import { Settings, Plus, Grid, List } from 'lucide-react';
import { PostCard } from './post-card';
import { BoardTile } from './board-tile';
import type { UserProfile } from '../data/mock-data';

interface ProfilePageProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
}

export function ProfilePage({ profile, isOwnProfile = true }: ProfilePageProps) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'feed'>('feed');

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Profile Header */}
      <div className="bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 lg:py-12">
          <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <img
                src={profile.avatar}
                alt={profile.displayName}
                className="w-24 h-24 lg:w-32 lg:h-32 rounded-full border-4 border-blue-100 shadow-md"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
                    {profile.displayName}
                  </h1>
                  <p className="text-base lg:text-lg text-gray-500">{profile.username}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                  {isOwnProfile ? (
                    <>
                      <button className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm text-sm lg:text-base">
                        <Plus className="w-4 h-4" />
                        New Post
                      </button>
                      <button className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm lg:text-base">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Create Board</span>
                        <span className="sm:hidden">Board</span>
                      </button>
                      <button className="p-2 lg:p-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
                        Follow
                      </button>
                      <button className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Message
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bio */}
              <p className="text-gray-700 leading-relaxed mb-6 max-w-2xl">
                {profile.bio}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-6 lg:gap-8">
                <div>
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {(profile.stats.followers / 1000).toFixed(1)}k
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">followers</span>
                </div>
                <div>
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {profile.stats.following}
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">following</span>
                </div>
                <div>
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {profile.stats.boards}
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">boards</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Boards Section */}
      <div className="bg-white border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Boards
              <span className="text-gray-500 font-normal ml-2">
                ({profile.boards.length})
              </span>
            </h2>
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View All
            </button>
          </div>

          {/* Horizontal Scrollable Board List */}
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {profile.boards.map((board) => (
                <BoardTile key={board.id} board={board} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Section Header with View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Posts
            <span className="text-gray-500 font-normal ml-2">
              ({profile.posts.length})
            </span>
          </h2>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm ${
                viewMode === 'feed'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              Feed
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
              Grid
            </button>
          </div>
        </div>

        {/* Posts Display */}
        {viewMode === 'feed' ? (
          <div className="max-w-2xl mx-auto">
            {profile.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.posts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group border border-gray-200"
              >
                {post.content.imageUrl ? (
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={post.content.imageUrl}
                      alt={post.content.title || 'Post'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-semibold text-sm line-clamp-2">
                          {post.content.title || post.content.caption}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span>❤️ {post.engagement.reactions}</span>
                          <span>💬 {post.engagement.comments}</span>
                          <span>🔖 {post.engagement.saves}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square p-6 flex flex-col justify-center bg-gradient-to-br from-blue-50 to-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-3">
                      {post.content.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-4">
                      {post.content.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom scrollbar hiding */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}