import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Search, Bell, User, Home, Plus, Filter, LogOut } from 'lucide-react';
import { AuthModal } from './components/auth-modal';
import { authApi, postsApi, boardsApi, usersApi } from './services/api';
import type { AuthUser } from './services/api';
import { PostCard } from './components/post-card';
import { BoardPreview } from './components/board-preview';
import { ProfilePage } from './components/profile-page';
import { BoardView } from './components/BoardView';
import { PostDetailView } from './components/PostDetailView';
import { CreatePostModal } from './components/create-post-modal';
import { CreateBoardModal } from './components/CreateBoardModal';
import { SearchModal } from './components/SearchModal';
import { NotificationsPage } from './components/NotificationsPage';
import { Toast } from './components/toast';
import { moodConfigs, type MoodType, type Board, type Post, type UserProfile } from './data/mock-data';

export default function App() {
  const [currentView, setCurrentView] = React.useState<'feed' | 'profile' | 'board' | 'post' | 'notifications'>('feed');
  const [selectedBoard, setSelectedBoard] = React.useState<Board | null>(null);
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
  const [showCreatePost, setShowCreatePost] = React.useState(false);
  const [showCreateBoard, setShowCreateBoard] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [selectedMoodFilter, setSelectedMoodFilter] = React.useState<MoodType | 'all'>('all');
  const [showMoodFilter, setShowMoodFilter] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [hasUnreadNotifications] = React.useState(true);

  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const isAuthenticated = currentUser !== null;

  // ── Данные из API ──────────────────────────────────────────────────────────
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [loadingFeed, setLoadingFeed] = React.useState(true);
  const [loadingBoards, setLoadingBoards] = React.useState(true);

  // ── Восстановление сессии при старте ──────────────────────────────────────
  // ── Восстановление сессии → затем фид (чтобы is_own пришёл с JWT) ──────────
  React.useEffect(() => {
    const init = async () => {
      setLoadingFeed(true);
      // Сначала восстанавливаем сессию — токен попадает в заголовки
      const user = await authApi.restoreSession().catch(() => null);
      if (user) setCurrentUser(user);
      // Только после этого грузим фид — бэкенд уже знает кто мы
      try {
        const feed = await postsApi.getFeed(1);
        setPosts(feed);
      } catch {
        setPosts([]);
      } finally {
        setLoadingFeed(false);
      }
    };
    init();
  }, []);

  // ── Загрузка досок ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    setLoadingBoards(true);
    boardsApi.getAll(10)
      .then(setBoards)
      .catch(() => setBoards([]))
      .finally(() => setLoadingBoards(false));
  }, []);

  // ── Загрузка профиля при переходе на вкладку Profile ──────────────────────
  React.useEffect(() => {
    if (currentView === 'profile' && currentUser && !userProfile) {
      usersApi.getProfile(currentUser.username)
        .then(setUserProfile)
        .catch(() => setUserProfile(null));
    }
  }, [currentView, currentUser, userProfile]);

  // ── Обработчики ───────────────────────────────────────────────────────────
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    postsApi.getFeed(1).then(setPosts).catch(() => {});
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    setUserProfile(null);
    setCurrentView('feed');
  };

  const handleFollow = async (boardId: string) => {
    try {
      await boardsApi.follow(boardId);
      setBoards(prev => prev.map(b =>
        b.id === boardId ? { ...b, isFollowing: true, followers: b.followers + 1 } : b
      ));
      setToastMessage('Board followed!');
    } catch {
      setToastMessage('Не удалось подписаться');
    }
    setShowToast(true);
  };

  const handlePostCreated = () => {
    setToastMessage('Пост опубликован!');
    setShowToast(true);
    // Перезагружаем фид
    postsApi.getFeed(1).then(setPosts).catch(() => {});
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setToastMessage('Пост удалён');
    setShowToast(true);
  };

  // ── Фильтрация постов по настроению ───────────────────────────────────────
  const filteredPosts = selectedMoodFilter === 'all'
    ? posts
    : posts.filter(post => post.mood === selectedMoodFilter);

  const leftBoards = boards.filter((_, i) => i % 2 === 0);
  const rightBoards = boards.filter((_, i) => i % 2 !== 0);

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Modals */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSuccess={handlePostCreated}
      />
      <CreateBoardModal
        isOpen={showCreateBoard}
        onClose={() => setShowCreateBoard(false)}
        onSuccess={() => {
          setToastMessage('Доска создана!');
          setShowToast(true);
          boardsApi.getAll(10).then(setBoards).catch(() => {});
        }}
      />
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onPostClick={(post) => { setSelectedPost(post); setCurrentView('post'); }}
        onBoardClick={(board) => { setSelectedBoard(board); setCurrentView('board'); }}
        onUserClick={(userId) => console.log('Navigate to user:', userId)}
        mockPosts={posts}
        mockBoards={boards}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900">НИТИ</h1>
              <button
                onClick={() => setShowSearch(true)}
                className="relative w-96 hidden lg:block text-left"
              >
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <div className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg hover:bg-white hover:border-blue-200 transition-all text-gray-500 cursor-pointer">
                  Поиск досок, тем, авторов...
                </div>
              </button>
            </div>
            <nav className="flex items-center gap-6">
              <button
                onClick={() => setCurrentView('feed')}
                className={`p-2 rounded-lg transition-colors ${currentView === 'feed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <Home className="w-6 h-6" />
              </button>
              <button
                onClick={() => isAuthenticated ? setCurrentView('profile') : setShowAuthModal(true)}
                className={`p-2 rounded-lg transition-colors ${currentView === 'profile' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <User className="w-6 h-6" />
              </button>
              <button
                onClick={() => setCurrentView('notifications')}
                className={`p-2 rounded-lg transition-colors relative ${currentView === 'notifications' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <Bell className="w-6 h-6" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
                )}
              </button>
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  title="Выйти"
                  className="p-2 rounded-lg transition-colors hover:bg-red-50 text-gray-500 hover:text-red-500"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Views */}
      {currentView === 'profile' ? (
        userProfile ? (
          <ProfilePage
            profile={userProfile}
            isOwnProfile={true}
            onCreatePost={() => setShowCreatePost(true)}
            onCreateBoard={() => setShowCreateBoard(true)}
            onBoardClick={(board) => { setSelectedBoard(board); setCurrentView('board'); }}
            onPostClick={(post) => { setSelectedPost(post); setCurrentView('post'); }}
            onPostDeleted={handlePostDeleted}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            {currentUser ? 'Загрузка профиля...' : 'Войдите чтобы увидеть профиль'}
          </div>
        )
      ) : currentView === 'board' && selectedBoard ? (
        <BoardView
          board={selectedBoard}
          posts={posts.filter(p => p.sourceBoard?.id === selectedBoard.id)}
          onBack={() => setCurrentView('feed')}
          onFollowToggle={async (boardId) => {
            await handleFollow(boardId);
          }}
          onPostClick={(post) => { setSelectedPost(post); setCurrentView('post'); }}
        />
      ) : currentView === 'post' && selectedPost ? (
        <PostDetailView
          post={selectedPost}
          onClose={() => setCurrentView('feed')}
          onDelete={(id) => { handlePostDeleted(id); setCurrentView('feed'); }}
          onBoardClick={(boardIdOrPartial) => {
            const id = typeof boardIdOrPartial === 'string' ? boardIdOrPartial : boardIdOrPartial.id;
            const found = boards.find(b => b.id === id);
            if (found) { setSelectedBoard(found); setCurrentView('board'); }
          }}
          relatedPosts={posts
            .filter(p => p.id !== selectedPost.id && p.sourceBoard?.id === selectedPost.sourceBoard?.id)
            .slice(0, 4)}
        />
      ) : currentView === 'notifications' ? (
        <NotificationsPage onClose={() => setCurrentView('feed')} />
      ) : (
        <>
          <div className="max-w-[1800px] mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Left Sidebar */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    Рекомендуемые доски
                  </h2>
                  {loadingBoards ? (
                    <div className="text-gray-400 text-sm text-center py-8">Загрузка...</div>
                  ) : (
                    <Masonry columnsCount={1} gutter="16px">
                      {leftBoards.map((board) => (
                        <BoardPreview
                          key={board.id}
                          board={board}
                          onFollow={handleFollow}
                          onClick={() => { setSelectedBoard(board); setCurrentView('board'); }}
                        />
                      ))}
                    </Masonry>
                  )}
                </div>
              </aside>

              {/* Center Feed */}
              <main className="lg:col-span-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 -mx-6">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <button
                        onClick={() => isAuthenticated ? setShowCreatePost(true) : setShowAuthModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Новый пост</span>
                      </button>
                    </div>

                    {/* Mood Filter */}
                    <div className="mb-4">
                      <button
                        onClick={() => setShowMoodFilter(!showMoodFilter)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                          selectedMoodFilter !== 'all'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        <span className="font-medium text-sm">
                          {selectedMoodFilter === 'all'
                            ? 'Настроить ленту'
                            : `Настроение: ${moodConfigs[selectedMoodFilter].label}`}
                        </span>
                        {selectedMoodFilter !== 'all' && (
                          <span className="text-lg">{moodConfigs[selectedMoodFilter].emoji}</span>
                        )}
                      </button>
                      {showMoodFilter && (
                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  </div>

                  {/* Posts */}
                  <div className="space-y-0">
                    {loadingFeed ? (
                      <div className="text-center py-12 text-gray-400">Загрузка постов...</div>
                    ) : filteredPosts.length > 0 ? (
                      filteredPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onClick={() => { setSelectedPost(post); setCurrentView('post'); }}
                          onDelete={handlePostDeleted}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">
                          {selectedMoodFilter !== 'all' ? 'Постов с таким настроением нет' : 'Постов пока нет. Создайте первый!'}
                        </p>
                        {selectedMoodFilter !== 'all' && (
                          <button
                            onClick={() => setSelectedMoodFilter('all')}
                            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Сбросить фильтр
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {filteredPosts.length > 0 && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => postsApi.getFeed(Math.ceil(posts.length / 20) + 1)
                          .then(more => setPosts(prev => [...prev, ...more]))
                          .catch(() => {})}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        Загрузить ещё
                      </button>
                    </div>
                  )}
                </div>
              </main>

              {/* Right Sidebar */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    В тренде
                  </h2>
                  {loadingBoards ? (
                    <div className="text-gray-400 text-sm text-center py-8">Загрузка...</div>
                  ) : (
                    <Masonry columnsCount={1} gutter="16px">
                      {rightBoards.map((board) => (
                        <BoardPreview
                          key={board.id}
                          board={board}
                          onFollow={handleFollow}
                          onClick={() => { setSelectedBoard(board); setCurrentView('board'); }}
                        />
                      ))}
                    </Masonry>
                  )}
                </div>
              </aside>
            </div>
          </div>

          {/* Mobile Board Discovery */}
          <div className="lg:hidden px-6 pb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Рекомендуемые доски</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {boards.map((board) => (
                <div key={board.id} className="flex-shrink-0 w-72">
                  <BoardPreview board={board} onFollow={handleFollow} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}