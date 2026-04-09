import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Settings, Plus, Grid, List, Trash2, Filter, Send, Bookmark } from 'lucide-react';
import { PostCard } from './post-card';
import { BoardTile } from './board-tile';
import { EditProfileModal } from './EditProfileModal';
import type { UserProfile, Board, Post } from '../data/mock-data';
import { postsApi, usersApi } from '../services/api';
import { FollowersModal } from './FollowersModal';
import { Avatar } from './Avatar';
import type { AuthUser } from '../services/api';
import { moodConfigs } from '../data/mock-data';

interface ProfilePageProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
  onCreatePost?: () => void;
  onBoardClick?: (board: Board) => void;
  onCreateBoard?: () => void;
  onPostClick?: (post: Post) => void;
  onPostDeleted?: (postId: string) => void;
  /** Вызывается после успешного сохранения профиля — обновляет данные в App */
  onProfileUpdated?: (user: AuthUser) => void;
  /** Вызывается при клике «Подписаться» на чужом профиле */
  onFollowToggle?: (username: string, isFollowing: boolean) => void;
  /** Переход на профиль пользователя из списка подписчиков/подписок */
  onUserClick?: (username: string) => void;
  /** Вызывается если нужна авторизация (неавторизованный нажал Подписаться) */
  onRequireAuth?: () => void;
  /** Передаётся из App — авторизован ли пользователь */
  isAuthenticated?: boolean;
  /** Username залогиненного пользователя (без @) для корректного отображения кнопок */
  currentLoggedInUsername?: string;
}

export function ProfilePage({
  profile,
  isOwnProfile = true,
  onCreatePost,
  onBoardClick,
  onCreateBoard,
  onPostClick,
  onPostDeleted,
  onProfileUpdated,
  onFollowToggle,
  onRequireAuth,
  isAuthenticated = false,
  onUserClick,
  currentLoggedInUsername,
}: ProfilePageProps) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'feed'>('feed');
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [followersModal, setFollowersModal] = React.useState<'followers' | 'following' | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(profile.isFollowing ?? false);
  const [followLoading, setFollowLoading] = React.useState(false);
  // Локальные счётчики — обновляются мгновенно без перезагрузки профиля
  const [localFollowers, setLocalFollowers] = React.useState(profile.stats.followers);
  const [localFollowing, setLocalFollowing] = React.useState(profile.stats.following);
  // При изменении подписки инкрементируем — модал перезагрузит список
  const [followReloadKey, setFollowReloadKey] = React.useState(0);

  // Новый фильтр типа постов
  const [feedTypeFilter, setFeedTypeFilter] = React.useState<Set<'reposts' | 'saved'>>(new Set());
  const [showFeedTypeFilter, setShowFeedTypeFilter] = React.useState(false);

  // Синхронизируем при смене профиля (например переход к другому пользователю)
  React.useEffect(() => {
    setIsFollowing(profile.isFollowing ?? false);
    setLocalFollowers(profile.stats.followers);
    setLocalFollowing(profile.stats.following);
  }, [profile.username]);

  const enrichedPosts = React.useMemo(() => {
    return profile.posts.map((post) => ({
      ...post,
      is_own: isOwnProfile || post.is_own || false,
    }));
  }, [profile.posts, isOwnProfile]);

  // Фильтрация постов по типу (reposts / saved)
  const filteredProfilePosts = React.useMemo(() => {
    let result = enrichedPosts;
    if (feedTypeFilter.size > 0) {
      result = result.filter((p) => {
        if (feedTypeFilter.has('reposts') && p.post_kind === 'repost') return true;
        if (feedTypeFilter.has('saved') && p.post_kind === 'saved') return true;
        return false;
      });
    }
    return result;
  }, [enrichedPosts, feedTypeFilter]);

  const toggleFeedType = (type: 'reposts' | 'saved') => {
    setFeedTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);
    const rawUsername = profile.username.startsWith('@')
      ? profile.username.slice(1)
      : profile.username;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setLocalFollowers((c) => wasFollowing ? Math.max(0, c - 1) : c + 1);

    try {
      if (wasFollowing) {
        await usersApi.unfollow(rawUsername);
      } else {
        await usersApi.follow(rawUsername);
      }
      onFollowToggle?.(rawUsername, !wasFollowing);
      setFollowReloadKey((k) => k + 1);
    } catch {
      setIsFollowing(wasFollowing);
      setLocalFollowers((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Followers / Following Modal */}
      {followersModal && (
        <FollowersModal
          username={profile.username.replace('@', '')}
          displayName={profile.displayName}
          initialTab={followersModal}
          followersCount={localFollowers}
          followingCount={localFollowing}
          isAuthenticated={isAuthenticated}
          currentUsername={currentLoggedInUsername}
          reloadKey={followReloadKey}
          onClose={async () => {
            setFollowersModal(null);
            try {
              const raw = profile.username.replace('@', '');
              const fresh = await usersApi.getProfile(raw);
              setLocalFollowers(fresh.stats.followers);
              setLocalFollowing(fresh.stats.following);
            } catch { /* ignore */ }
          }}
          onUserClick={(u) => { setFollowersModal(null); onUserClick?.(u); }}
          onRequireAuth={onRequireAuth || (() => {})}
          onFollowingCountChange={(delta) => setLocalFollowing((c) => Math.max(0, c + delta))}
          onFollowersCountChange={(delta) => setLocalFollowers((c) => Math.max(0, c + delta))}
        />
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        profile={profile}
        onClose={() => setShowEditModal(false)}
        onSaved={(updatedUser) => {
          onProfileUpdated?.(updatedUser);
          setShowEditModal(false);
        }}
      />

      {/* Profile Header */}
      <div className="bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 lg:py-12">
          <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <Avatar
                key={profile.avatar}
                src={profile.avatar}
                alt={profile.displayName}
                username={profile.displayName}
                size={128}
                className="border-4 border-blue-100 shadow-md lg:w-32 lg:h-32 w-24 h-24"
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
                      <button
                        className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm text-sm lg:text-base"
                        onClick={onCreatePost}
                      >
                        <Plus className="w-4 h-4" />
                        Новый пост
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm lg:text-base"
                        onClick={onCreateBoard}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Создать доску</span>
                        <span className="sm:hidden">Доска</span>
                      </button>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-2 lg:p-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Редактировать профиль"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={`px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 ${
                        isFollowing
                          ? 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isFollowing ? 'Отписаться' : 'Подписаться'}
                    </button>
                  )}
                </div>
              </div>

              {/* Bio */}
              <p className="text-gray-700 leading-relaxed mb-6 max-w-2xl">
                {profile.bio}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-6 lg:gap-8">
                <button
                  onClick={() => setFollowersModal('followers')}
                  className="text-left hover:opacity-70 transition-opacity"
                >
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {localFollowers >= 1000
                      ? `${(localFollowers / 1000).toFixed(1)}k`
                      : localFollowers}
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">подписчиков</span>
                </button>
                <button
                  onClick={() => setFollowersModal('following')}
                  className="text-left hover:opacity-70 transition-opacity"
                >
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {localFollowing}
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">подписок</span>
                </button>
                <div>
                  <span className="text-xl lg:text-2xl font-semibold text-gray-900">
                    {profile.stats.boards}
                  </span>
                  <span className="text-gray-500 ml-1.5 text-sm lg:text-base">досок</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Boards Section */}
      {profile.boards.length > 0 && (
        <div className="bg-white border-b border-blue-100">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Доски
                <span className="text-gray-500 font-normal ml-2">({profile.boards.length})</span>
              </h2>
            </div>
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                {profile.boards.map((board) => (
                  <BoardTile key={board.id} board={board} onClick={() => onBoardClick?.(board)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts Section */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Посты
            <span className="text-gray-500 font-normal ml-2">({filteredProfilePosts.length})</span>
          </h2>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm ${
                viewMode === 'feed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              Лента
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
              Сетка
            </button>
          </div>
        </div>

        {/* Фильтр типа постов */}
        <div className="mb-4">
          <button
            onClick={() => setShowFeedTypeFilter(!showFeedTypeFilter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              feedTypeFilter.size > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400 text-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium text-sm">
              {feedTypeFilter.size === 0
                ? 'Настроить ленту постов'
                : [...feedTypeFilter].map(t => t === 'reposts' ? 'Репосты' : 'Сохранённое').join(', ')}
            </span>
            {feedTypeFilter.size > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFeedTypeFilter(new Set()); }}
                className="ml-1 text-blue-500 hover:text-blue-700"
              >
                ×
              </button>
            )}
          </button>
          {showFeedTypeFilter && (
            <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFeedTypeFilter(new Set()); setShowFeedTypeFilter(false); }}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    feedTypeFilter.size === 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Все
                </button>
                {(['reposts', 'saved'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleFeedType(type)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-1.5 ${
                      feedTypeFilter.has(type) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {type === 'reposts' ? <><Send className="w-3.5 h-3.5" />Репосты</> : <><Bookmark className="w-3.5 h-3.5" />Сохранённое</>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {filteredProfilePosts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">
              {feedTypeFilter.size > 0 ? 'Постов с выбранными фильтрами нет' : 'Постов пока нет'}
            </p>
            {isOwnProfile && feedTypeFilter.size === 0 && (
              <button
                onClick={onCreatePost}
                className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Создать первый пост
              </button>
            )}
          </div>
        )}

        {viewMode === 'feed' ? (
          <div className="max-w-2xl mx-auto">
            {filteredProfilePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => onPostClick?.(post)}
                onDelete={onPostDeleted}
              />
            ))}
          </div>
        ) : (
          <Masonry
            columnsCount={3}
            gutter="12px"
            breakpointCols={{ default: 3, 900: 2, 500: 1 }}
          >
            {filteredProfilePosts.map((post) => {
              const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;
              return (
                <div
                  key={post.id}
                  onClick={() => onPostClick?.(post)}
                  className="rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200/60 mb-0"
                  style={{ backgroundColor: postMoodConfig ? postMoodConfig.pastelBg : '#ffffff' }}
                >
                  {post.content.imageUrl ? (
                    <div className="relative overflow-hidden">
                      <img
                        src={post.content.imageUrl}
                        alt={post.content.title || 'Post'}
                        className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      {(post.is_own ?? false) && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Удалить пост?')) return;
                            try {
                              await postsApi.delete(post.id);
                              onPostDeleted?.(post.id);
                            } catch {
                              alert('Ошибка при удалении');
                            }
                          }}
                          className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Удалить пост"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          {postMoodConfig && (
                            <span className="text-base mb-1 block">{postMoodConfig.emoji}</span>
                          )}
                          {(post.content.title || post.content.caption) && (
                            <h3 className="font-semibold text-sm line-clamp-2 mb-1.5">
                              {post.content.title || post.content.caption}
                            </h3>
                          )}
                          <div className="flex items-center gap-3 text-xs text-white/80">
                            <span>❤️ {post.engagement.reactions}</span>
                            <span>💬 {post.engagement.comments}</span>
                            <span>🔖 {post.engagement.saves}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 relative min-h-[120px] flex flex-col justify-center">
                      {(post.is_own ?? false) && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Удалить пост?')) return;
                            try {
                              await postsApi.delete(post.id);
                              onPostDeleted?.(post.id);
                            } catch {
                              alert('Ошибка при удалении');
                            }
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/10 hover:bg-red-600 hover:text-white text-gray-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Удалить пост"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {postMoodConfig && (
                        <div className="text-2xl mb-2">{postMoodConfig.emoji}</div>
                      )}
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
        )}
      </div>

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}