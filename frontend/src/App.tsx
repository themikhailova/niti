import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Search, Compass, Bell, User, Home, LogIn, LogOut, X } from 'lucide-react';
import { PostCard } from './components/post-card';
import { BoardPreview } from './components/board-preview';
import { ProfilePage } from './components/profile-page';
import { AuthModal } from './components/auth-modal';
import { postsApi, boardsApi, usersApi, authApi } from './services/api';
import type { SearchUser } from './services/api';
import type { Post, Board, UserProfile } from './data/mock-data';
import type { AuthUser } from './services/api';
import { mockPosts, mockBoards, mockUserProfile } from './data/mock-data';

export default function App() {
  const [currentView, setCurrentView] = React.useState<'feed' | 'profile'>('feed');
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);

  const [posts, setPosts] = React.useState<Post[]>(mockPosts);
  const [boards, setBoards] = React.useState<Board[]>(mockBoards);
  const [profile, setProfile] = React.useState<UserProfile>(mockUserProfile);
  const [loading, setLoading] = React.useState(false);

  // Поиск
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchUser[]>([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Проверяем сессию при загрузке
  React.useEffect(() => {
    authApi.me().then(setCurrentUser);
  }, []);

  // Загружаем данные ленты
  React.useEffect(() => {
    if (currentView !== 'feed') return;

    setLoading(true);

    Promise.all([postsApi.getFeed(), boardsApi.getAll()])
      .then(([p, b]) => {
        setPosts(p && p.length > 0 ? p : mockPosts);     // ← если пусто от API → моки
        setBoards(b && b.length > 0 ? b : mockBoards);
      })
      .catch(err => {
        console.error("Ошибка загрузки ленты → использую моки", err);
        setPosts(mockPosts);
        setBoards(mockBoards);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentView]);

  // Загружаем профиль
  React.useEffect(() => {
    if (currentView === 'profile' && currentUser) {
      usersApi.getProfile(currentUser.username).then(setProfile);
    }
  }, [currentView, currentUser]);

  // Закрытие поиска по клику снаружи
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounce поиска
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const results = await usersApi.search(q);
      setSearchResults(results);
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const leftBoards = boards.filter((_, i) => i % 2 === 0);
  const rightBoards = boards.filter((_, i) => i % 2 !== 0);

  const handleFollow = async (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (!board) return;
    if (board.isFollowing) {
      await boardsApi.unfollow(boardId);
    } else {
      await boardsApi.follow(boardId);
    }
    setBoards(prev =>
      prev.map(b => b.id === boardId ? { ...b, isFollowing: !b.isFollowing } : b)
    );
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-blue-50/30">
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user) => { setCurrentUser(user); setShowAuthModal(false); }}
        />
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900">niti</h1>

              {/* Search */}
              <div ref={searchRef} className="relative w-96 hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery && setSearchOpen(true)}
                  placeholder="Поиск пользователей..."
                  className="w-full pl-10 pr-9 py-2 bg-blue-50/50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Dropdown */}
                {searchOpen && (searchResults.length > 0 || searchQuery) && (
                  <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                    {searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Ничего не найдено</div>
                    ) : (
                      searchResults.map(user => (
                        <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors">
                          <img src={user.avatar} alt={user.displayName}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{user.displayName}</p>
                            <p className="text-xs text-gray-500 truncate">{user.username}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {(user.followersCount / 1000).toFixed(1)}k
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <nav className="flex items-center gap-6">
              <button
                onClick={() => setCurrentView('feed')}
                className={`p-2 rounded-lg transition-colors ${currentView === 'feed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <Home className="w-6 h-6" />
              </button>
              <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors">
                <Compass className="w-6 h-6 text-gray-700" />
              </button>
              <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors relative">
                <Bell className="w-6 h-6 text-gray-700" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
              </button>

              {currentUser ? (
                <>
                  <button
                    onClick={() => setCurrentView('profile')}
                    className={`p-2 rounded-lg transition-colors ${currentView === 'profile' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
                  >
                    <User className="w-6 h-6" />
                  </button>
                  <button onClick={handleLogout} className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-gray-500">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Войти
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Views */}
      {currentView === 'profile' ? (
        <ProfilePage profile={profile} isOwnProfile={true} />
      ) : (
        <>
          <div className="max-w-[1800px] mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    Открыть доски
                  </h2>
                  <Masonry columnsCount={1} gutter="16px">
                    {leftBoards.map(board => (
                      <BoardPreview key={board.id} board={board} onFollow={handleFollow} />
                    ))}
                  </Masonry>
                </div>
              </aside>

              <main className="lg:col-span-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 -mx-6">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-3xl font-semibold text-gray-900 mb-2">Лента</h2>
                    <p className="text-gray-600">Контент из ваших досок и рекомендации</p>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                      Загрузка...
                    </div>
                  ) : (
                    <div>
                      {posts.map(post => <PostCard key={post.id} post={post} />)}
                    </div>
                  )}

                  <div className="mt-8 text-center">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md">
                      Загрузить ещё
                    </button>
                  </div>
                </div>
              </main>

              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    В тренде
                  </h2>
                  <Masonry columnsCount={1} gutter="16px">
                    {rightBoards.map(board => (
                      <BoardPreview key={board.id} board={board} onFollow={handleFollow} />
                    ))}
                  </Masonry>
                </div>
              </aside>
            </div>
          </div>

          <div className="lg:hidden px-6 pb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Доски</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {boards.map(board => (
                <div key={board.id} className="flex-shrink-0 w-72">
                  <BoardPreview board={board} onFollow={handleFollow} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
