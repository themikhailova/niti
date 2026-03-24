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
  // Читаем начальный view из hash (#profile, #notifications, etc.)
  const getViewFromHash = (): 'feed' | 'profile' | 'board' | 'post' | 'notifications' => {
    const hash = window.location.hash.replace('#', '');
    if (['feed', 'profile', 'notifications'].includes(hash)) {
      return hash as 'feed' | 'profile' | 'notifications';
    }
    return 'feed';
  };
  const [currentView, setCurrentView] = React.useState<'feed' | 'profile' | 'board' | 'post' | 'notifications'>(getViewFromHash);
  const [selectedBoard, setSelectedBoard] = React.useState<Board | null>(null);
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
  const [previousView, setPreviousView] = React.useState<'feed' | 'profile' | 'board'>('feed');
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

  /**
   * Патчит аватар и имя автора в массиве постов для текущего пользователя.
   * Нужно потому что бэкенд может вернуть старый кэшированный аватар.
   */
  const patchPostsWithCurrentUser = React.useCallback(
    (postsArr: Post[], user: AuthUser, avatarUrl: string): Post[] =>
      postsArr.map((p) => {
        if (p.author.username.replace('@', '') === user.username) {
          return {
            ...p,
            author: { ...p.author, avatar: avatarUrl, name: user.username, username: `@${user.username}` },
          };
        }
        return p;
      }),
    []
  );

  // Синхронизируем hash с текущим view (post/board не пишем в hash — они эфемерны)
  const navigateTo = React.useCallback(
    (view: 'feed' | 'profile' | 'board' | 'post' | 'notifications') => {
      setCurrentView(view);
      if (view === 'feed' || view === 'profile' || view === 'notifications') {
        window.history.replaceState(null, '', `#${view}`);
      }
    },
    []
  );

  // ── Данные из API ──────────────────────────────────────────────────────────
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [boards, setBoards] = React.useState<Board[]>([]);

  // Собственный профиль (currentUser)
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Профиль чужого пользователя (из поиска)
  const [viewedProfile, setViewedProfile] = React.useState<UserProfile | null>(null);
  const [viewingOwnProfile, setViewingOwnProfile] = React.useState(true);
  // username профиля открытого из поиска до авторизации
  const [pendingProfileUsername, setPendingProfileUsername] = React.useState<string | null>(null);

  const [loadingFeed, setLoadingFeed] = React.useState(true);
  const [loadingBoards, setLoadingBoards] = React.useState(true);
  const [loadingProfile, setLoadingProfile] = React.useState(false);

  // ── Восстановление сессии ──────────────────────────────────────────────────
  React.useEffect(() => {
    const init = async () => {
      setLoadingFeed(true);
      const user = await authApi.restoreSession().catch(() => null);
      if (user) {
        setCurrentUser(user);
        const hash = window.location.hash.replace('#', '');
        if (hash === 'profile') {
          setViewingOwnProfile(true);
        }
      } else {
        const hash = window.location.hash.replace('#', '');
        if (hash === 'profile' || hash === 'notifications') {
          window.history.replaceState(null, '', '#feed');
          setCurrentView('feed');
        }
      }
      try {
        const feed = await postsApi.getFeed(1);
        // Если пользователь авторизован — сразу патчим его посты актуальным аватаром
        if (user) {
          const raw = user.avatar || '';
          const av = raw && !raw.startsWith('data:') && !raw.includes('?v=')
            ? `${raw}?v=${Date.now()}` : raw;
          setPosts(patchPostsWithCurrentUser(feed, user, av));
        } else {
          setPosts(feed);
        }
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

  // ── Загрузка своего профиля при первом открытии вкладки Profile ───────────
  React.useEffect(() => {
    if (currentView === 'profile' && viewingOwnProfile && currentUser && !userProfile) {
      setLoadingProfile(true);
      usersApi.getProfile(currentUser.username)
        .then(setUserProfile)
        .catch(() => setUserProfile(null))
        .finally(() => setLoadingProfile(false));
    }
  }, [currentView, currentUser, userProfile, viewingOwnProfile]);

  // ── Обработчики ───────────────────────────────────────────────────────────
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    postsApi.getFeed(1).then((feed) => {
      if (currentUser) {
        const raw = currentUser.avatar || '';
        const av = raw && !raw.startsWith('data:') && !raw.includes('?v=') ? raw : raw;
        setPosts(patchPostsWithCurrentUser(feed, currentUser, av));
      } else {
        setPosts(feed);
      }
    }).catch(() => {});

    // Если до авторизации пользователь открыл чей-то профиль из поиска
    if (pendingProfileUsername) {
      const pending = pendingProfileUsername;
      setPendingProfileUsername(null);
      if (pending === user.username) {
        // Это был его собственный профиль — показываем как свой
        setViewingOwnProfile(true);
        navigateTo('profile');
      } else {
        // Чужой профиль — загружаем его
        handleNavigateToUser(pending);
      }
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    setUserProfile(null);
    setViewedProfile(null);
    setPendingProfileUsername(null);
    navigateTo('feed');
  };

  /** Открыть профиль пользователя по username (из поиска) */
  const handleNavigateToUser = async (username: string) => {
    // Если это наш профиль — показываем его
    if (currentUser && currentUser.username === username) {
      setViewingOwnProfile(true);
      navigateTo('profile');
      return;
    }

    // Запоминаем username — пригодится если пользователь авторизуется с этой страницы
    setPendingProfileUsername(username);

    // Сбрасываем старый чужой профиль чтобы не было вспышки старых данных
    setViewedProfile(null);
    setLoadingProfile(true);
    setViewingOwnProfile(false);
    navigateTo('profile');

    try {
      const profile = await usersApi.getProfile(username);
      setViewedProfile(profile);
    } catch {
      setToastMessage('Не удалось загрузить профиль');
      setShowToast(true);
      navigateTo('feed');
      setPendingProfileUsername(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  /** Сохранение изменений профиля — обновляем currentUser, userProfile и все посты */
  const handleProfileUpdated = (updatedUser: AuthUser) => {
    // Cache-buster только для реальных URL, не для data: URI
    const rawAvatar = updatedUser.avatar || '';
    const avatarUrl = rawAvatar && !rawAvatar.startsWith('data:') && !rawAvatar.includes('?v=')
      ? `${rawAvatar}?v=${Date.now()}`
      : rawAvatar;

    const patchedUser = { ...updatedUser, avatar: avatarUrl };
    setCurrentUser(patchedUser);

    // Синхронизируем userProfile
    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            displayName: updatedUser.username,
            username: `@${updatedUser.username}`,
            avatar: avatarUrl,
            bio: updatedUser.bio || '',
            // Обновляем аватар и username в постах профиля
            posts: prev.posts.map((p) =>
              p.author.username === prev.username || p.author.username === `@${prev.username.replace('@', '')}`
                ? {
                    ...p,
                    author: {
                      ...p.author,
                      avatar: avatarUrl,
                      name: updatedUser.username,
                      username: `@${updatedUser.username}`,
                    },
                  }
                : p
            ),
          }
        : prev
    );

    // Синхронизируем аватар и имя автора во всех постах ленты
    if (currentUser) {
      const oldUsername = currentUser.username;
      setPosts((prev) =>
        prev.map((p) => {
          const postUsername = p.author.username.replace('@', '');
          if (postUsername === oldUsername) {
            return {
              ...p,
              author: {
                ...p.author,
                avatar: avatarUrl,
                name: updatedUser.username,
                username: `@${updatedUser.username}`,
              },
            };
          }
          return p;
        })
      );
    }

    setToastMessage('Профиль обновлён!');
    setShowToast(true);
  };

  const handleFollow = async (boardId: string) => {
    try {
      await boardsApi.follow(boardId);
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, isFollowing: true, followers: b.followers + 1 } : b))
      );
      setToastMessage('Подписка оформлена!');
    } catch {
      setToastMessage('Не удалось подписаться');
    }
    setShowToast(true);
  };

  const handlePostCreated = () => {
    setToastMessage('Пост опубликован!');
    setShowToast(true);
    postsApi.getFeed(1).then((feed) => {
      if (currentUser) {
        const raw = currentUser.avatar || '';
        const av = raw && !raw.startsWith('data:') && !raw.includes('?v=') ? raw : raw;
        setPosts(patchPostsWithCurrentUser(feed, currentUser, av));
      } else {
        setPosts(feed);
      }
    }).catch(() => {});
    if (userProfile && currentUser) {
      postsApi.getMyPosts().then((myPosts) => {
        setUserProfile((prev) => (prev ? { ...prev, posts: myPosts } : prev));
      }).catch(() => {});
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setUserProfile((prev) =>
      prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev
    );
    setToastMessage('Пост удалён');
    setShowToast(true);
  };

  // ── Фильтрация постов ─────────────────────────────────────────────────────
  const filteredPosts =
    selectedMoodFilter === 'all' ? posts : posts.filter((p) => p.mood === selectedMoodFilter);

  const leftBoards = boards.filter((_, i) => i % 2 === 0);
  const rightBoards = boards.filter((_, i) => i % 2 !== 0);

  // ── Какой профиль показывать ──────────────────────────────────────────────
  const activeProfile = viewingOwnProfile ? userProfile : viewedProfile;
  const isOwnProfile = viewingOwnProfile;

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
        onPostClick={(post) => { setPreviousView(currentView === 'board' ? 'board' : currentView === 'profile' ? 'profile' : 'feed'); setSelectedPost(post); setCurrentView('post'); }}
        onBoardClick={(board) => { setSelectedBoard(board); setCurrentView('board'); }}
        onUserClick={handleNavigateToUser}
        mockPosts={posts}
        mockBoards={boards}
        currentUsername={currentUser?.username}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => setShowAuthModal(true)}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer"
                onClick={() => navigateTo('feed')}
              >
                НИТИ
              </h1>
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
                onClick={() => navigateTo('feed')}
                className={`p-2 rounded-lg transition-colors ${currentView === 'feed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <Home className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    setViewingOwnProfile(true);
                    navigateTo('profile');
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${currentView === 'profile' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <User className="w-6 h-6" />
              </button>
              <button
                onClick={() => isAuthenticated ? navigateTo('notifications') : setShowAuthModal(true)}
                className={`p-2 rounded-lg transition-colors relative ${currentView === 'notifications' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}
              >
                <Bell className="w-6 h-6" />
                {isAuthenticated && hasUnreadNotifications && (
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
        loadingProfile ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Загрузка профиля...
          </div>
        ) : activeProfile ? (
          <ProfilePage
            profile={activeProfile}
            isOwnProfile={isOwnProfile}
            isAuthenticated={isAuthenticated}
            onCreatePost={() => setShowCreatePost(true)}
            onCreateBoard={() => setShowCreateBoard(true)}
            onBoardClick={(board) => { setSelectedBoard(board); setCurrentView('board'); }}
            onPostClick={(post) => { setPreviousView(currentView === 'board' ? 'board' : currentView === 'profile' ? 'profile' : 'feed'); setSelectedPost(post); setCurrentView('post'); }}
            onPostDeleted={handlePostDeleted}
            onProfileUpdated={handleProfileUpdated}
            onRequireAuth={() => setShowAuthModal(true)}
            onUserClick={handleNavigateToUser}
            currentLoggedInUsername={currentUser?.username}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            {currentUser ? 'Не удалось загрузить профиль' : 'Войдите чтобы увидеть профиль'}
          </div>
        )
      ) : currentView === 'board' && selectedBoard ? (
        <BoardView
          board={selectedBoard}
          posts={posts.filter((p) => p.sourceBoard?.id === selectedBoard.id)}
          onBack={() => navigateTo('feed')}
          onFollowToggle={async (boardId) => { await handleFollow(boardId); }}
          onPostClick={(post) => { setPreviousView(currentView === 'board' ? 'board' : currentView === 'profile' ? 'profile' : 'feed'); setSelectedPost(post); setCurrentView('post'); }}
        />
      ) : currentView === 'post' && selectedPost ? (
        <PostDetailView
          post={selectedPost}
          onClose={() => navigateTo(previousView)}
          onDelete={(id) => { handlePostDeleted(id); navigateTo(previousView); }}
          onBoardClick={(boardIdOrPartial) => {
            const id = typeof boardIdOrPartial === 'string' ? boardIdOrPartial : boardIdOrPartial.id;
            const found = boards.find((b) => b.id === id);
            if (found) { setSelectedBoard(found); setCurrentView('board'); }
          }}
          onAuthorClick={(username) => handleNavigateToUser(username)}
          relatedPosts={posts
            .filter((p) => p.id !== selectedPost.id && p.sourceBoard?.id === selectedPost.sourceBoard?.id)
            .slice(0, 4)}
          isAuthenticated={isAuthenticated}
          currentUsername={currentUser?.username}
          onRequireAuth={() => setShowAuthModal(true)}
        />
      ) : currentView === 'notifications' ? (
        <NotificationsPage onClose={() => navigateTo(previousView)} />
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
                        onClick={() => (isAuthenticated ? setShowCreatePost(true) : setShowAuthModal(true))}
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
                          onClick={() => { setPreviousView(currentView === 'profile' ? 'profile' : currentView === 'board' ? 'board' : 'feed'); setSelectedPost(post); setCurrentView('post'); }}
                          onDelete={handlePostDeleted}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">
                          {selectedMoodFilter !== 'all'
                            ? 'Постов с таким настроением нет'
                            : 'Постов пока нет. Создайте первый!'}
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
                        onClick={() =>
                          postsApi
                            .getFeed(Math.ceil(posts.length / 20) + 1)
                            .then((more) => setPosts((prev) => [...prev, ...more]))
                            .catch(() => {})
                        }
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