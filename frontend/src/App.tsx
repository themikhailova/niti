import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Search, Bell, User, Home, Plus, Filter, LogOut } from 'lucide-react';
import { AuthModal } from './components/auth-modal';
import { authApi, postsApi, boardsApi, usersApi } from './services/api';
import type { AuthUser } from './services/api';
import { PostCard } from './components/post-card';
import { BoardPreview } from './components/board-preview';
import { ProfilePage } from './components/ProfilePage';
import { BoardView } from './components/BoardView';
import { PostDetailView } from './components/PostDetailView';
import { CreatePostModal } from './components/create-post-modal';
import { CreateBoardModal } from './components/CreateBoardModal';
import { SearchModal } from './components/SearchModal';
import { NotificationsPage } from './components/NotificationsPage';
import { Toast } from './components/toast';
import { moodConfigs, type MoodType, type Board, type Post, type UserProfile } from './data/mock-data';

// Высота шапки — для calc() в колонках фида
const HEADER_H = 73;

export default function App() {
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

  const [posts, setPosts] = React.useState<Post[]>([]);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [recommendedBoards, setRecommendedBoards] = React.useState<Board[]>([]);
  const [subscribedBoards, setSubscribedBoards] = React.useState<Board[]>([]);

  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [savedPosts, setSavedPosts] = React.useState<Post[]>([]);
  const [viewedProfile, setViewedProfile] = React.useState<UserProfile | null>(null);
  const [viewingOwnProfile, setViewingOwnProfile] = React.useState(true);
  const [pendingProfileUsername, setPendingProfileUsername] = React.useState<string | null>(null);

  const [loadingFeed, setLoadingFeed] = React.useState(true);
  const [loadingBoards, setLoadingBoards] = React.useState(true);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [createPostInitialBoardId, setCreatePostInitialBoardId] = React.useState<string | null>(null);

  const patchPostsWithCurrentUser = React.useCallback(
    (postsArr: Post[], user: AuthUser, avatarUrl: string): Post[] =>
      postsArr.map((p) => {
        if (p.author.username.replace('@', '') === user.username) {
          return { ...p, author: { ...p.author, avatar: avatarUrl, name: user.username, username: `@${user.username}` } };
        }
        return p;
      }),
    []
  );

  const mkAvatar = (user: AuthUser) => {
    const raw = user.avatar || '';
    return raw && !raw.startsWith('data:') && !raw.includes('?v=') ? `${raw}?v=${Date.now()}` : raw;
  };

  const navigateTo = React.useCallback(
    (view: 'feed' | 'profile' | 'board' | 'post' | 'notifications') => {
      setCurrentView(view);
      if (view === 'feed' || view === 'profile' || view === 'notifications') {
        window.history.replaceState(null, '', `#${view}`);
      }
    },
    []
  );

  React.useEffect(() => {
    const init = async () => {
      setLoadingFeed(true);
      const user = await authApi.restoreSession().catch(() => null);
      if (user) {
        setCurrentUser(user);
        if (window.location.hash.replace('#', '') === 'profile') setViewingOwnProfile(true);
      } else {
        const hash = window.location.hash.replace('#', '');
        if (hash === 'profile' || hash === 'notifications') {
          window.history.replaceState(null, '', '#feed');
          setCurrentView('feed');
        }
      }
      try {
        const feed = await postsApi.getFeed(1);
        setPosts(user ? patchPostsWithCurrentUser(feed, user, mkAvatar(user)) : feed);
      } catch {
        setPosts([]);
      } finally {
        setLoadingFeed(false);
      }
    };
    init();
  }, []);

  const loadBoards = React.useCallback(async () => {
    setLoadingBoards(true);
    try {
      // Загружаем рекомендованные (всегда)
      const recommended = await boardsApi.getRecommended(6);
      setRecommendedBoards(recommended);
      
      // Загружаем подписки только если пользователь авторизован
      if (currentUser) {
        const subscribed = await boardsApi.getSubscribed(6);
        setSubscribedBoards(subscribed);
      } else {
        // Для гостей показываем trending
        const trending = await boardsApi.getTrending(6);
        setSubscribedBoards(trending);
      }
      
      // Объединяем для мобильной версии
      const seen = new Set<string>();
      const allBoards = [...recommended, ...(currentUser ? subscribedBoards : [])];
      setBoards(allBoards.filter(b => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      }));
    } catch (error) {
      console.error('Failed to load boards:', error);
    } finally {
      setLoadingBoards(false);
    }
  }, [currentUser]);

  React.useEffect(() => { loadBoards(); }, [loadBoards]);

  React.useEffect(() => {
    if (currentView === 'profile' && viewingOwnProfile && currentUser) {
      loadSavedPosts();
    }
  }, [currentView, viewingOwnProfile, currentUser]);

  React.useEffect(() => {
    if (currentView === 'profile' && viewingOwnProfile && currentUser && !userProfile) {
      setLoadingProfile(true);
      usersApi.getProfile(currentUser.username)
        .then(setUserProfile)
        .catch(() => setUserProfile(null))
        .finally(() => setLoadingProfile(false));
    }
  }, [currentView, currentUser, userProfile, viewingOwnProfile]);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    const av = mkAvatar(user);
    postsApi.getFeed(1).then((feed) => setPosts(patchPostsWithCurrentUser(feed, user, av))).catch(() => {});
    if (pendingProfileUsername) {
      const pending = pendingProfileUsername;
      setPendingProfileUsername(null);
      if (pending === user.username) { setViewingOwnProfile(true); navigateTo('profile'); }
      else handleNavigateToUser(pending);
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

  const handleNavigateToUser = async (username: string) => {
    if (currentUser && currentUser.username === username) {
      setViewingOwnProfile(true);
      navigateTo('profile');
      return;
    }
    setPendingProfileUsername(username);
    setViewedProfile(null);
    setLoadingProfile(true);
    setViewingOwnProfile(false);
    navigateTo('profile');
    try {
      setViewedProfile(await usersApi.getProfile(username));
    } catch {
      setToastMessage('Не удалось загрузить профиль');
      setShowToast(true);
      navigateTo('feed');
      setPendingProfileUsername(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleProfileUpdated = (updatedUser: AuthUser) => {
    const av = mkAvatar(updatedUser);
    setCurrentUser({ ...updatedUser, avatar: av });
    setUserProfile((prev) =>
      prev ? {
        ...prev,
        displayName: updatedUser.username,
        username: `@${updatedUser.username}`,
        avatar: av,
        bio: updatedUser.bio || '',
        posts: prev.posts.map((p) =>
          p.author.username === prev.username || p.author.username === `@${prev.username.replace('@', '')}`
            ? { ...p, author: { ...p.author, avatar: av, name: updatedUser.username, username: `@${updatedUser.username}` } }
            : p
        ),
      } : prev
    );
    if (currentUser) {
      const old = currentUser.username;
      setPosts((prev) => prev.map((p) =>
        p.author.username.replace('@', '') === old
          ? { ...p, author: { ...p.author, avatar: av, name: updatedUser.username, username: `@${updatedUser.username}` } }
          : p
      ));
    }
    setToastMessage('Профиль обновлён!');
    setShowToast(true);
  };

  const openCreatePostWithBoard = (boardId: string) => {
    setCreatePostInitialBoardId(boardId);
    setShowCreatePost(true);
  };

  const refreshBoardsAndProfile = React.useCallback(async () => {
    try { setBoards(await boardsApi.getAll(10)); } catch {}
    if (currentUser && viewingOwnProfile) {
      try { setUserProfile(await usersApi.getProfile(currentUser.username)); } catch {}
    }
    if (currentUser) {
      try {
        const myPosts = await postsApi.getMyPosts();
        setUserProfile((prev) => prev ? { ...prev, posts: myPosts } : prev);
        const freshFeed = await postsApi.getFeed(1);
        setPosts(patchPostsWithCurrentUser(freshFeed, currentUser, mkAvatar(currentUser)));
      } catch {}
    }
  }, [currentUser, viewingOwnProfile]);

  const handleFollow = async (boardId: string) => {
    try {
      const result = await boardsApi.follow(boardId);
      
      // Обновляем статус в recommendedBoards
      setRecommendedBoards(prev => prev.map(b => 
        b.id === boardId ? { ...b, isFollowing: true, followers: result.followers } : b
      ));
      
      // Если подписались - добавляем доску в subscribedBoards
      if (result.isFollowing) {
        const board = recommendedBoards.find(b => b.id === boardId);
        if (board) {
          setSubscribedBoards(prev => [board, ...prev].slice(0, 6));
        }
      } else {
        // Если отписались - удаляем из subscribedBoards
        setSubscribedBoards(prev => prev.filter(b => b.id !== boardId));
      }
      
      setToastMessage(result.isFollowing ? 'Подписка оформлена!' : 'Вы отписались');
    } catch {
      setToastMessage('Не удалось изменить подписку');
    }
    setShowToast(true);
  };

  const handlePostCreated = () => {
    setToastMessage('Пост опубликован!');
    setShowToast(true);
    postsApi.getFeed(1).then((feed) => {
      setPosts(currentUser ? patchPostsWithCurrentUser(feed, currentUser, mkAvatar(currentUser)) : feed);
    }).catch(() => {});
    if (userProfile && currentUser) {
      postsApi.getMyPosts().then((myPosts) => {
        setUserProfile((prev) => prev ? { ...prev, posts: myPosts } : prev);
      }).catch(() => {});
    }
  };

  const loadSavedPosts = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await postsApi.getMySavedPosts();
      setSavedPosts(res.posts ?? []);
    } catch {
      setSavedPosts([]);
    }
  }, [currentUser]);

  const handlePostSaved = (post: Post) => {
    // После сохранения — перезагружаем список сохранённых
    loadSavedPosts();
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setUserProfile((prev) => prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev);
    setToastMessage('Пост удалён');
    setShowToast(true);
  };

  const filteredPosts = React.useMemo(() =>
    selectedMoodFilter === 'all' ? posts : posts.filter((p) => p.mood === selectedMoodFilter),
    [posts, selectedMoodFilter]
  );

  // Объединяем обычные посты + сохранённые для собственного профиля
  const mergedUserProfile = React.useMemo(() => {
    if (!userProfile || !viewingOwnProfile) return userProfile;
    // Избегаем дублей: сохранённые посты добавляем только если их нет среди обычных
    const ownIds = new Set(userProfile.posts.map((p) => p.id));
    const extraSaved = savedPosts.filter((p) => !ownIds.has(p.id));
    return { ...userProfile, posts: [...userProfile.posts, ...extraSaved] };
  }, [userProfile, savedPosts, viewingOwnProfile]);

  const activeProfile = viewingOwnProfile ? mergedUserProfile : viewedProfile;

  // Стиль для колонок фида с независимым скроллом
  const colStyle: React.CSSProperties = {
    height: `calc(100vh - ${HEADER_H}px)`,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
  };

  return (
    // ↓ min-h-screen без overflow-hidden — профиль/доска/уведомления скроллятся нормально
    <div className="min-h-screen bg-blue-50/30">

      {/* Modals */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => { setShowCreatePost(false); setCreatePostInitialBoardId(null); }}
        onSuccess={handlePostCreated}
        initialBoardId={createPostInitialBoardId}
        currentUsername={currentUser?.username}
      />
      <CreateBoardModal
        isOpen={showCreateBoard}
        onClose={() => setShowCreateBoard(false)}
        onSuccess={async () => {
          setToastMessage('Доска создана!');
          setShowToast(true);
          loadBoards();
          await refreshBoardsAndProfile();
          try {
            const freshFeed = await postsApi.getFeed(1);
            setPosts(currentUser ? patchPostsWithCurrentUser(freshFeed, currentUser, mkAvatar(currentUser)) : freshFeed);
          } catch {}
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

      {/* Header — sticky поверх всего */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900 cursor-pointer" onClick={() => navigateTo('feed')}>
                НИТИ
              </h1>
              <button onClick={() => setShowSearch(true)} className="relative w-96 hidden lg:block text-left">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <div className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg hover:bg-white hover:border-blue-200 transition-all text-gray-500 cursor-pointer">
                  Поиск досок, тем, авторов...
                </div>
              </button>
            </div>
            <nav className="flex items-center gap-6">
              <button onClick={() => navigateTo('feed')} className={`p-2 rounded-lg transition-colors ${currentView === 'feed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'}`}>
                <Home className="w-6 h-6" />
              </button>
              <button
                onClick={() => { if (isAuthenticated) { setViewingOwnProfile(true); navigateTo('profile'); } else setShowAuthModal(true); }}
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
                <button onClick={handleLogout} title="Выйти" className="p-2 rounded-lg transition-colors hover:bg-red-50 text-gray-500 hover:text-red-500">
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Профиль: обычный скролл страницы ── */}
      {currentView === 'profile' && (
        loadingProfile ? (
          <div className="flex items-center justify-center h-64 text-gray-500">Загрузка профиля...</div>
        ) : activeProfile ? (
          <ProfilePage
            profile={activeProfile}
            isOwnProfile={viewingOwnProfile}
            isAuthenticated={isAuthenticated}
            onCreatePost={() => setShowCreatePost(true)}
            onCreateBoard={() => setShowCreateBoard(true)}
            onBoardClick={(board) => { setPreviousView('profile'); setSelectedBoard(board); setCurrentView('board'); }}
            onPostClick={(post) => { setPreviousView('profile'); setSelectedPost(post); setCurrentView('post'); }}
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
      )}

      {/* ── Доска: обычный скролл страницы ── */}
      {currentView === 'board' && selectedBoard && (
        <BoardView
          board={selectedBoard}
          posts={posts.filter((p) => p.sourceBoard?.id === selectedBoard.id)}
          onBack={() => navigateTo('feed')}
          onFollowToggle={async (boardId) => { await handleFollow(boardId); }}
          onPostClick={(post) => { setPreviousView('board'); setSelectedPost(post); setCurrentView('post'); }}
          currentUsername={currentUser?.username}
          onCreatePostWithBoard={openCreatePostWithBoard}
          onBoardUpdated={refreshBoardsAndProfile}
          onBoardDeleted={async () => {
            await refreshBoardsAndProfile();
            navigateTo(previousView === 'profile' ? 'profile' : 'feed');
            setToastMessage('Доска удалена');
            setShowToast(true);
          }}
        />
      )}

      {/* ── Пост: обычный скролл страницы ── */}
      {currentView === 'post' && selectedPost && (
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
          relatedPosts={posts.filter((p) => p.id !== selectedPost.id && p.sourceBoard?.id === selectedPost.sourceBoard?.id).slice(0, 4)}
          isAuthenticated={isAuthenticated}
          currentUsername={currentUser?.username}
          onRequireAuth={() => setShowAuthModal(true)}
        />
      )}

      {/* ── Уведомления: обычный скролл страницы ── */}
      {currentView === 'notifications' && (
        <NotificationsPage onClose={() => navigateTo(previousView)} />
      )}

      {/* ── Фид: три независимо скроллируемые колонки ── */}
      {currentView === 'feed' && (
        <>
          <div className="max-w-[1800px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

              {/* Left Sidebar */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40" style={colStyle}>
                <div className="p-6">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    Рекомендуемые доски
                  </h2>
                  {loadingBoards ? (
                    <div className="text-gray-400 text-sm text-center py-8">Загрузка...</div>
                  ) : (
                    <Masonry columnsCount={1} gutter="16px">
                      {recommendedBoards.map((board) => (
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
              <main className="lg:col-span-6 bg-white/80 backdrop-blur-sm shadow-sm" style={colStyle}>
                <div className="max-w-2xl mx-auto p-8">
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
                          selectedMoodFilter !== 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        <span className="font-medium text-sm">
                          {selectedMoodFilter === 'all' ? 'Настроить ленту' : `Настроение: ${moodConfigs[selectedMoodFilter].label}`}
                        </span>
                        {selectedMoodFilter !== 'all' && <span className="text-lg">{moodConfigs[selectedMoodFilter].emoji}</span>}
                      </button>
                      {showMoodFilter && (
                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => { setSelectedMoodFilter('all'); setShowMoodFilter(false); }}
                              className={`p-3 rounded-lg border transition-all text-center ${selectedMoodFilter === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
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
                                  className={`p-3 rounded-lg border transition-all ${isSelected ? `${mood.borderColor} ${mood.lightBg}` : 'border-gray-200 hover:border-gray-300'}`}
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
                          onClick={() => { setPreviousView('feed'); setSelectedPost(post); setCurrentView('post'); }}
                          onDelete={handlePostDeleted}
                          onSaved={handlePostSaved}
                          onRequireAuth={() => setShowAuthModal(true)}
                          currentUsername={currentUser?.username}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">
                          {selectedMoodFilter !== 'all' ? 'Постов с таким настроением нет' : 'Постов пока нет. Создайте первый!'}
                        </p>
                        {selectedMoodFilter !== 'all' && (
                          <button onClick={() => setSelectedMoodFilter('all')} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                            Сбросить фильтр
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {filteredPosts.length > 0 && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => postsApi.getFeed(Math.ceil(posts.length / 20) + 1).then((more) => setPosts((prev) => [...prev, ...more])).catch(() => {})}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        Загрузить ещё
                      </button>
                    </div>
                  )}
                </div>
              </main>

              {/* Right Sidebar */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40" style={colStyle}>
                <div className="p-6">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    {currentUser ? 'Мои подписки' : 'В тренде'}
                  </h2>
                  {loadingBoards ? (
                    <div className="text-gray-400 text-sm text-center py-8">Загрузка...</div>
                  ) : subscribedBoards.length > 0 ? (
                    <Masonry columnsCount={1} gutter="16px">
                      {subscribedBoards.map((board) => (
                        <BoardPreview
                          key={board.id}
                          board={board}
                          onFollow={handleFollow}
                          onClick={() => { setSelectedBoard(board); setCurrentView('board'); }}
                        />
                      ))}
                    </Masonry>
                  ) : (
                    <div className="text-center py-8">
                      {currentUser ? (
                        <>
                          <p className="text-gray-500 text-sm mb-3">
                            Вы ещё не подписаны ни на одну доску
                          </p>
                          <button
                            onClick={() => setShowCreateBoard(true)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Создать доску
                          </button>
                        </>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          <button
                            onClick={() => setShowAuthModal(true)}
                            className="text-blue-600 hover:underline"
                          >
                            Войдите
                          </button>
                          , чтобы видеть подписки
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </aside>

            </div>
          </div>

          {/* Mobile */}
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