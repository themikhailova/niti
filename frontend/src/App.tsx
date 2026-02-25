import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Search, Compass, Bell, User, Home, LogIn, LogOut } from 'lucide-react';
import { PostCard } from './components/post-card';
import { BoardPreview } from './components/board-preview';
import { ProfilePage } from './components/profile-page';
import { AuthModal } from './components/auth-modal';
import { postsApi, boardsApi, usersApi, authApi } from './services/api';
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

  // Проверяем сессию при загрузке
  React.useEffect(() => {
    authApi.me().then(setCurrentUser);
  }, []);

  // Загружаем данные ленты
  React.useEffect(() => {
    if (currentView === 'feed') {
      setLoading(true);
      Promise.all([postsApi.getFeed(), boardsApi.getAll()])
        .then(([p, b]) => { setPosts(p); setBoards(b); })
        .finally(() => setLoading(false));
    }
  }, [currentView]);

  // Загружаем профиль
  React.useEffect(() => {
    if (currentView === 'profile' && currentUser) {
      usersApi.getProfile(currentUser.username).then(setProfile);
    }
  }, [currentView, currentUser]);

  const leftBoards = boards.filter((_, i) => i % 2 === 0);
  const rightBoards = boards.filter((_, i) => i % 2 !== 0);

  const handleFollow = async (boardId: string) => {
    await boardsApi.follow(boardId);
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
      {/* Auth Modal */}
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
              <h1 className="text-2xl font-bold text-gray-900">Curate</h1>
              <div className="relative w-96 hidden lg:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск досок, тем, авторов..."
                  className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                />
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

          {/* Mobile */}
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
