import React from 'react';
import { Avatar } from './Avatar';
import Masonry from 'react-responsive-masonry';
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
  currentUsername?: string;
  onCreatePostWithBoard?: (boardId: string) => void;
  onBoardUpdated?: () => void; 
  onBoardDeleted?: () => void; 
}

export function BoardView({ 
  board, 
  posts, 
  onBack, 
  onFollowToggle, 
  onPostClick, 
  currentUsername,
  onCreatePostWithBoard,
  onBoardUpdated,
  onBoardDeleted,
}: BoardViewProps) {
  const [viewMode, setViewMode] = React.useState<'feed' | 'grid'>('feed');
  const [selectedMoodFilter, setSelectedMoodFilter] = React.useState<MoodType | 'all'>('all');
  const [showMoodFilter, setShowMoodFilter] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showEditBoard, setShowEditBoard] = React.useState(false);

  // Определяем, является ли текущий пользователь владельцем доски
  const boardCreatorUsername = board.creator?.username?.replace('@', '');
  const isOwner = !!(currentUsername && boardCreatorUsername && currentUsername === boardCreatorUsername);

  // Filter posts by mood and search
  const filteredPosts = posts.filter(post => {
    const matchesMood = selectedMoodFilter === 'all' || post.mood === selectedMoodFilter;
    const matchesSearch = searchQuery === '' ||
      post.content.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.text?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMood && matchesSearch;
  });


  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Board Header with Cover Image */}
      <div className="relative">
        {/* Cover Image */}
        <div className="relative h-64 lg:h-96 overflow-hidden">
          {board.coverImage ? (
            <img
              src={board.coverImage}
              alt={board.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          
          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
            <span className="font-medium text-gray-700">Назад</span>
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
                  <span>{((board.followers || 0) / 1000).toFixed(1)}k подписчиков</span>
                </div>
                <span>•</span>
                <span>{board.postCount} постов</span>
                {board.collaborators > 0 && (
                  <>
                    <span>•</span>
                    <span>{board.collaborators} соавторов</span>
                  </>
                )}
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
                {/* Кнопка подписки только для НЕ-владельцев */}
                {!isOwner && (
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
                        Подписан
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Подписаться
                      </>
                    )}
                  </button>
                )}

                {isOwner && onCreatePostWithBoard && (
                  <button
                    onClick={() => onCreatePostWithBoard(board.id)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <Plus className="w-5 h-5" />
                    Новый пост
                  </button>
                )}

                {/* Существующие кнопки */}
                <button className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Share2 className="w-5 h-5 text-gray-700" />
                </button>
                <button className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-700" />
                </button>

                {/* Настройки — только для владельца */}
                {isOwner && (
                  <button
                    onClick={() => setShowEditBoard(true)}
                    className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-700" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <aside className="lg:col-span-3 space-y-6">
            {/* Board Stats Card */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100/50 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Статистика доски</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Всего постов</span>
                  <span className="font-semibold text-gray-900">{(board.postCount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Подписчики</span>
                  <span className="font-semibold text-gray-900">{((board.followers || 0) / 1000).toFixed(1)}k</span>
                </div>
                {board.collaborators > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Соавторы</span>
                    <span className="font-semibold text-gray-900">{board.collaborators}</span>
                  </div>
                )}
                {board.createdAt && (
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      Создана {new Date(board.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Creator Card */}
            {board.creator && (
              <div className="bg-white rounded-xl shadow-sm border border-blue-100/50 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Создатель</h3>
                <div className="flex items-center gap-3">
                  <Avatar
                    src={board.creator.avatar}
                    alt={board.creator.username}
                    username={board.creator.username}
                    size={40}
                    className="ring-2 ring-blue-50"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{board.creator.username}</p>
                  </div>
                </div>
              </div>
            )}
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
                    placeholder="Поиск постов в доске..."
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
                          ? 'Фильтр по настроению'
                          : moodConfigs[selectedMoodFilter].label}
                      </span>
                      {selectedMoodFilter !== 'all' && (
                        <span className="text-lg">{moodConfigs[selectedMoodFilter].emoji}</span>
                      )}
                    </button>

                    {showMoodFilter && (
                      <div className="absolute top-full mt-2 right-0 z-10 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px]">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => { setSelectedMoodFilter('all'); setShowMoodFilter(false); }}
                            className={`p-3 rounded-lg border transition-all text-center ${
                              selectedMoodFilter === 'all'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="font-medium text-sm">Все</span>
                          </button>
                          {(Object.keys(moodConfigs) as MoodType[]).map((moodKey) => {
                            const mood = moodConfigs[moodKey];
                            const isSelected = selectedMoodFilter === moodKey;
                            return (
                              <button
                                key={moodKey}
                                onClick={() => { setSelectedMoodFilter(moodKey); setShowMoodFilter(false); }}
                                className={`p-3 rounded-lg border transition-all ${
                                  isSelected ? `${mood.borderColor} ${mood.lightBg}` : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-xl">{mood.emoji}</span>
                                  <span className="font-medium text-xs" style={{ color: isSelected ? mood.color : undefined }}>
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
                        viewMode === 'feed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm font-medium">Лента</span>
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                        viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Grid className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm font-medium">Сетка</span>
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
                <Masonry columnsCount={3} gutter="12px">
                  {filteredPosts.map((post) => {
                    const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onPostClick?.(post)}
                        className="rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200/60"
                        style={{ backgroundColor: postMoodConfig ? postMoodConfig.pastelBg : '#ffffff' }}
                      >
                        {post.content.imageUrl ? (
                          <div className="relative overflow-hidden">
                            <img
                              src={post.content.imageUrl}
                              alt={post.content.title || 'Post'}
                              className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                {postMoodConfig && <span className="text-base mb-1 block">{postMoodConfig.emoji}</span>}
                                {(post.content.title || post.content.caption) && (
                                  <h3 className="font-semibold text-sm line-clamp-2 mb-1.5">
                                    {post.content.title || post.content.caption}
                                  </h3>
                                )}
                                <div className="flex items-center gap-3 text-xs text-white/80">
                                  <span>❤️ {post.engagement.reactions}</span>
                                  <span>💬 {post.engagement.comments}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 min-h-[120px] flex flex-col justify-center">
                            {postMoodConfig && <div className="text-2xl mb-2">{postMoodConfig.emoji}</div>}
                            {post.content.title && (
                              <h3 className="font-semibold text-gray-900 text-sm mb-1.5 line-clamp-3">
                                {post.content.title}
                              </h3>
                            )}
                            <p className="text-xs text-gray-600 line-clamp-5">
                              {post.content.text || post.content.caption}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                              <span>❤️ {post.engagement.reactions}</span>
                              <span>💬 {post.engagement.comments}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Masonry>
              )
            ) : (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-blue-100/50">
                <p className="text-gray-500 text-lg mb-2">Постов не найдено</p>
                <p className="text-gray-400 text-sm mb-6">
                  {searchQuery ? 'Попробуйте изменить поиск или фильтры' : 'Добавьте первый пост в доску!'}
                </p>
                {(searchQuery || selectedMoodFilter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedMoodFilter('all'); }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Edit Board Modal — только для владельца */}
      {isOwner && (
        <EditBoardModal
          isOpen={showEditBoard}
          board={board}
          onClose={() => setShowEditBoard(false)}
          onSuccess={() => {
            setShowEditBoard(false);
            onBoardUpdated?.(); 
          }}
          onDelete={() => {
            setShowEditBoard(false);
            onBoardDeleted?.(); 
          }}
        />
      )}
    </div>
  );
}