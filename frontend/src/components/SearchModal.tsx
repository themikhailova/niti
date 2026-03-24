import React from 'react';
import { X, Search, TrendingUp, Clock, Hash, Users, Loader2 } from 'lucide-react';
import type { Post, Board, MoodType } from '../data/mock-data';
import { moodConfigs } from '../data/mock-data';
import { usersApi } from '../services/api';
import { Avatar } from './Avatar';
import type { SearchUser } from '../services/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostClick?: (post: Post) => void;
  onBoardClick?: (board: Board) => void;
  onUserClick?: (username: string) => void;
  mockPosts?: Post[];
  mockBoards?: Board[];
  currentUsername?: string;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export function SearchModal({
  isOpen,
  onClose,
  onPostClick,
  onBoardClick,
  onUserClick,
  mockPosts = [],
  mockBoards = [],
  currentUsername,
  isAuthenticated = false,
  onRequireAuth,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'all' | 'posts' | 'boards' | 'users' | 'tags'>('all');
  const [apiUsers, setApiUsers] = React.useState<SearchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [followingMap, setFollowingMap] = React.useState<Record<string, boolean>>({});
  const [followLoadingMap, setFollowLoadingMap] = React.useState<Record<string, boolean>>({});

  const [recentSearches] = React.useState<string[]>(['minimalist design', 'nature photography', 'abstract art']);
  const [trendingSearches] = React.useState<string[]>(['spring aesthetics', 'urban exploration', 'botanical illustrations', 'editorial layouts', 'peaceful moods']);

  React.useEffect(() => {
    if (!searchQuery.trim()) { setApiUsers([]); setFollowingMap({}); return; }
    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const results = await usersApi.search(searchQuery.trim());
        const filtered = currentUsername
          ? results.filter((u) => {
              const uName = u.username.startsWith('@') ? u.username.slice(1) : u.username;
              return uName.toLowerCase() !== currentUsername.toLowerCase();
            })
          : results;
        setApiUsers(filtered);
        const map: Record<string, boolean> = {};
        filtered.forEach((u) => { map[u.id] = u.isFollowing; });
        setFollowingMap(map);
      } catch { setApiUsers([]); }
      finally { setLoadingUsers(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUsername]);

  const handleFollowToggle = async (e: React.MouseEvent, user: SearchUser) => {
    e.stopPropagation();
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    const rawUsername = user.username.startsWith('@') ? user.username.slice(1) : user.username;
    const currentlyFollowing = followingMap[user.id] ?? user.isFollowing;
    setFollowLoadingMap((prev) => ({ ...prev, [user.id]: true }));
    setFollowingMap((prev) => ({ ...prev, [user.id]: !currentlyFollowing }));
    try {
      if (currentlyFollowing) { await usersApi.unfollow(rawUsername); }
      else { await usersApi.follow(rawUsername); }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [user.id]: currentlyFollowing }));
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const localResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { posts: [], boards: [], tags: [] };
    const query = searchQuery.toLowerCase();
    const posts = mockPosts.filter((p) => p.content.title?.toLowerCase().includes(query) || p.content.caption?.toLowerCase().includes(query) || p.content.text?.toLowerCase().includes(query));
    const boards = mockBoards.filter((b) => b.name.toLowerCase().includes(query) || b.description.toLowerCase().includes(query) || b.tags?.some((t) => t.toLowerCase().includes(query)));
    const allTags = new Set<string>();
    mockBoards.forEach((b) => b.tags?.forEach((t) => { if (t.toLowerCase().includes(query)) allTags.add(t); }));
    return { posts: posts.slice(0, 10), boards: boards.slice(0, 8), tags: Array.from(allTags).slice(0, 10) };
  }, [searchQuery, mockPosts, mockBoards]);

  const searchResults = { posts: localResults.posts, boards: localResults.boards, users: apiUsers, tags: localResults.tags };
  const hasResults = searchQuery.trim() && (searchResults.posts.length > 0 || searchResults.boards.length > 0 || searchResults.users.length > 0 || searchResults.tags.length > 0);
  const filteredResults = (() => {
    switch (activeTab) {
      case 'posts':   return { ...searchResults, boards: [], users: [], tags: [] };
      case 'boards':  return { ...searchResults, posts: [], users: [], tags: [] };
      case 'users':   return { ...searchResults, posts: [], boards: [], tags: [] };
      case 'tags':    return { ...searchResults, posts: [], boards: [], users: [] };
      default:        return searchResults;
    }
  })();
  const totalResults = searchResults.posts.length + searchResults.boards.length + searchResults.users.length + searchResults.tags.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="relative border-b border-gray-200">
            <div className="flex items-center gap-3 px-6 py-4">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск постов, досок, пользователей..." autoFocus
                className="flex-1 text-lg outline-none placeholder:text-gray-400" />
              {loadingUsers && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            {searchQuery.trim() && (
              <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
                {[
                  { key: 'all', label: `Все (${totalResults})` },
                  { key: 'posts', label: `Посты (${searchResults.posts.length})` },
                  { key: 'boards', label: `Доски (${searchResults.boards.length})` },
                  { key: 'users', label: `Авторы (${searchResults.users.length})` },
                  { key: 'tags', label: `Теги (${searchResults.tags.length})` },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!searchQuery.trim() ? (
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Недавние поиски</h3>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((s, i) => (
                      <button key={i} onClick={() => setSearchQuery(s)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 text-sm">В тренде</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((s, i) => (
                      <button key={i} onClick={() => setSearchQuery(s)} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors">{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : hasResults ? (
              <div className="p-6 space-y-6">

                {/* Posts */}
                {filteredResults.posts.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Посты</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {filteredResults.posts.map((post) => {
                        const moodCfg = post.mood ? moodConfigs[post.mood] : null;
                        return (
                          <button key={post.id} onClick={() => { onPostClick?.(post); onClose(); }}
                            className="rounded-lg overflow-hidden group border border-gray-200 hover:shadow-md transition-all"
                            style={{ backgroundColor: moodCfg?.pastelBg || '#ffffff' }}>
                            {post.content.imageUrl ? (
                              <div className="relative aspect-square overflow-hidden">
                                <img src={post.content.imageUrl} alt={post.content.title || 'Post'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                {moodCfg && <div className="absolute top-2 left-2"><span className="text-lg drop-shadow-md">{moodCfg.emoji}</span></div>}
                              </div>
                            ) : (
                              <div className="aspect-square p-3 flex flex-col justify-center">
                                {moodCfg && <span className="text-xl mb-1">{moodCfg.emoji}</span>}
                                <p className="text-xs font-medium text-gray-900 line-clamp-3 text-left">{post.content.title || post.content.text}</p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Boards */}
                {filteredResults.boards.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Доски</h3>
                    <div className="space-y-2">
                      {filteredResults.boards.map((board) => (
                        <button key={board.id} onClick={() => { onBoardClick?.(board); onClose(); }}
                          className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                          <img src={board.coverImage} alt={board.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{board.name}</h4>
                            <p className="text-sm text-gray-600 line-clamp-1">{board.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{(board.followers / 1000).toFixed(1)}k подписчиков</span>
                              <span>•</span>
                              <span>{board.postCount} постов</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users */}
                {filteredResults.users.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Авторы</h3>
                    </div>
                    <div className="space-y-2">
                      {filteredResults.users.map((user) => {
                        const isFollowing = followingMap[user.id] ?? user.isFollowing;
                        const isLoading = followLoadingMap[user.id] ?? false;
                        return (
                          <div key={user.id} onClick={() => { const raw = user.username.startsWith('@') ? user.username.slice(1) : user.username; onUserClick?.(raw); onClose(); }}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 cursor-pointer">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar src={user.avatar} alt={user.displayName} username={user.displayName} size={48} className="ring-2 ring-blue-100" />
                              <div className="text-left min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{user.displayName}</p>
                                <p className="text-sm text-gray-500">{user.username}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {user.followersCount >= 1000 ? `${(user.followersCount / 1000).toFixed(1)}k` : user.followersCount} подписчиков
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleFollowToggle(e, user)}
                              disabled={isLoading}
                              className={`ml-3 flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                                isFollowing
                                  ? 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}>
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? 'Отписаться' : 'Подписаться'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {filteredResults.tags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Теги</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filteredResults.tags.map((tag, i) => (
                        <button key={i} onClick={() => setSearchQuery(tag)} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors">#{tag}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : loadingUsers ? (
              <div className="p-12 flex items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /><span>Поиск...</span>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Ничего не найдено</h3>
                <p className="text-gray-500 text-sm">Попробуйте другие ключевые слова</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}