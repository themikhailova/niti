import React from 'react';
import { ArrowLeft, Users, Plus, Check, Share2, MoreVertical, Grid, List, Filter, Search, Settings } from 'lucide-react';
import { PostCard } from './post-card';
import { EditBoardModal } from './EditBoardModal';
import type { Board, Post, MoodType } from '../data/mock-data';
import { moodConfigs } from '../data/mock-data';

interface BoardViewProps {
  board: Board;
  posts: Post[];
  onBack: () => void;
  onFollowToggle: (boardId: string) => void;
  onPostClick?: (post: Post) => void;
}

export function BoardView({ board, posts, onBack, onFollowToggle, onPostClick }: BoardViewProps) {
  const [viewMode, setViewMode] = React.useState<'feed' | 'grid'>('feed');
  const [selectedMoodFilter, setSelectedMoodFilter] = React.useState<MoodType | 'all'>('all');
  const [showMoodFilter, setShowMoodFilter] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showEditBoard, setShowEditBoard] = React.useState(false);

  // Filter posts by mood and search
  const filteredPosts = posts.filter(post => {
    const matchesMood = selectedMoodFilter === 'all' || post.mood === selectedMoodFilter;
    const matchesSearch = searchQuery === '' || 
      post.content.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.text?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMood && matchesSearch;
  });

  // Mock collaborators (in real app, would come from API)
  const collaborators = [
    { id: '1', name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' },
    { id: '2', name: 'Marcus Chen', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80' },
    { id: '3', name: 'Sophia Anderson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' },
    { id: '4', name: 'Yuki Tanaka', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80' },
    { id: '5', name: 'James Mitchell', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' },
  ];

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Board Header with Cover Image */}
      <div className="relative">
        {/* Cover Image */}
        <div className="relative h-64 lg:h-96 overflow-hidden">
          <img
            src={board.coverImage}
            alt={board.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          
          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-700">Back</span>
          </button>

          {/* Board Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl lg:text-5xl font-bold text-white mb-2 drop-shadow-lg">
                {board.name}
              </h1>
              <div className="flex items-center gap-4 text-white/90 text-sm lg:text-base">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{(board.followers / 1000).toFixed(1)}k followers</span>
                </div>
                <span>•</span>
                <span>{board.postCount} posts</span>
                <span>•</span>
                <span>{board.collaborators} collaborators</span>
              </div>
            </div>
          </div>
        </div>

        {/* Board Info Bar */}
        <div className="bg-white border-b border-blue-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <p className="text-gray-700 text-base lg:text-lg leading-relaxed mb-4">
                  {board.description}
                </p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {board.tags?.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => onFollowToggle(board.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all shadow-sm ${
                    board.isFollowing
                      ? 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {board.isFollowing ? (
                    <>
                      <Check className="w-5 h-5" />
                      Following
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Follow Board
                    </>
                  )}
                </button>
                <button className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Share2 className="w-5 h-5 text-gray-700" />
                </button>
                <button className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => setShowEditBoard(true)}
                  className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Collaborators & Info */}
          <aside className="lg:col-span-3 space-y-6">
            {/* Collaborators Card */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Collaborators</h3>
                <span className="text-sm text-gray-500">{board.collaborators}</span>
              </div>
              <div className="space-y-3">
                {collaborators.slice(0, 5).map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center gap-3">
                    <img
                      src={collaborator.avatar}
                      alt={collaborator.name}
                      className="w-10 h-10 rounded-full ring-2 ring-blue-50"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {collaborator.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {board.collaborators > 5 && (
                <button className="w-full mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm">
                  View all {board.collaborators} collaborators
                </button>
              )}
            </div>

            {/* Board Stats Card */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100/50 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Board Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Posts</span>
                  <span className="font-semibold text-gray-900">{(board.postCount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Followers</span>
                  <span className="font-semibold text-gray-900">{((board.followers || 0) / 1000).toFixed(1)}k</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Collaborators</span>
                  <span className="font-semibold text-gray-900">{board.collaborators || 0}</span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Created February 2025</span>
                </div>
              </div>
            </div>

            {/* Guidelines Card */}
            <div className="bg-blue-50/50 rounded-xl border border-blue-100/50 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Board Guidelines</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Share high-quality, relevant content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Engage thoughtfully with posts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Credit original creators</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Keep discussions respectful</span>
                </li>
              </ul>
            </div>
          </aside>

          {/* Main Content - Posts */}
          <main className="lg:col-span-9">
            {/* Filters & View Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100/50 p-4 lg:p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts in this board..."
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Mood Filter */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMoodFilter(!showMoodFilter)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                        selectedMoodFilter !== 'all'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700 bg-white'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      <span className="font-medium text-sm">
                        {selectedMoodFilter === 'all' 
                          ? 'Filter by Mood' 
                          : moodConfigs[selectedMoodFilter].label}
                      </span>
                      {selectedMoodFilter !== 'all' && (
                        <span className="text-lg">{moodConfigs[selectedMoodFilter].emoji}</span>
                      )}
                    </button>

                    {/* Mood Filter Dropdown */}
                    {showMoodFilter && (
                      <div className="absolute top-full mt-2 right-0 z-10 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px]">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSelectedMoodFilter('all');
                              setShowMoodFilter(false);
                            }}
                            className={`p-3 rounded-lg border transition-all text-center ${
                              selectedMoodFilter === 'all'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="font-medium text-sm">All Moods</span>
                          </button>
                          {(Object.keys(moodConfigs) as MoodType[]).map((moodKey) => {
                            const mood = moodConfigs[moodKey];
                            const isSelected = selectedMoodFilter === moodKey;
                            
                            return (
                              <button
                                key={moodKey}
                                onClick={() => {
                                  setSelectedMoodFilter(moodKey);
                                  setShowMoodFilter(false);
                                }}
                                className={`p-3 rounded-lg border transition-all ${
                                  isSelected
                                    ? `${mood.borderColor} ${mood.lightBg}`
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-xl">{mood.emoji}</span>
                                  <span 
                                    className="font-medium text-xs"
                                    style={{ color: isSelected ? mood.color : undefined }}
                                  >
                                    {mood.label}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('feed')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                        viewMode === 'feed'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm font-medium">Feed</span>
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Grid className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm font-medium">Grid</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts Display */}
            {filteredPosts.length > 0 ? (
              viewMode === 'feed' ? (
                <div className="space-y-0">
                  {filteredPosts.map((post) => (
                    <PostCard key={post.id} post={post} onClick={() => onPostClick?.(post)} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map((post) => {
                    const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;
                    
                    return (
                      <div
                        key={post.id}
                        onClick={() => onPostClick?.(post)}
                        className="rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group border border-gray-200"
                        style={{ backgroundColor: postMoodConfig ? postMoodConfig.pastelBg : '#ffffff' }}
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
                                <div className="flex items-center gap-2 mb-2">
                                  {postMoodConfig && (
                                    <span className="text-xl">{postMoodConfig.emoji}</span>
                                  )}
                                  <h3 className="font-semibold text-sm line-clamp-2 flex-1">
                                    {post.content.title || post.content.caption}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span>❤️ {post.engagement.reactions}</span>
                                  <span>💬 {post.engagement.comments}</span>
                                  <span>🔖 {post.engagement.saves}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square p-6 flex flex-col justify-center">
                            {postMoodConfig && (
                              <div className="text-3xl mb-3">{postMoodConfig.emoji}</div>
                            )}
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-3">
                              {post.content.title}
                            </h3>
                            <p className="text-sm text-gray-600 line-clamp-4">
                              {post.content.text}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-blue-100/50">
                <p className="text-gray-500 text-lg mb-2">No posts found</p>
                <p className="text-gray-400 text-sm mb-6">
                  {searchQuery ? 'Try adjusting your search or filters' : 'Be the first to contribute!'}
                </p>
                {(searchQuery || selectedMoodFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedMoodFilter('all');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Load More */}
            {filteredPosts.length > 0 && (
              <div className="mt-8 text-center">
                <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md">
                  Load More Posts
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Edit Board Modal */}
      <EditBoardModal
        isOpen={showEditBoard}
        board={board}
        onClose={() => setShowEditBoard(false)}
        onSuccess={() => {
          console.log('Board updated successfully');
          setShowEditBoard(false);
        }}
      />
    </div>
  );
}