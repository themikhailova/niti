import React from 'react';
import Masonry from 'react-responsive-masonry';
import { Search, Bell, User, Home, Plus, Filter, LogOut } from 'lucide-react';
import { AuthModal } from './components/auth-modal';
import { authApi, tokenStorage } from './services/api';
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
import { mockPosts, mockBoards, mockUserProfile, moodConfigs, type MoodType, type Board, type Post } from './data/mock-data';

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
  const [hasUnreadNotifications, setHasUnreadNotifications] = React.useState(true);
  
const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const isAuthenticated = currentUser !== null;

  // Восстанавливаем сессию при старте
  React.useEffect(() => {
    authApi.restoreSession().then(user => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    setCurrentView('feed');
  };

  // Split boards into left and right columns
  const leftBoards = mockBoards.filter((_, index) => index % 2 === 0);
  const rightBoards = mockBoards.filter((_, index) => index % 2 !== 0);

  const handleFollow = (boardId: string) => {
    console.log('Following board:', boardId);
    // In a real app, this would update the state
    setToastMessage('Board followed successfully!');
    setShowToast(true);
  };

  // Filter posts by mood
  const filteredPosts = selectedMoodFilter === 'all' 
    ? mockPosts 
    : mockPosts.filter(post => post.mood === selectedMoodFilter);

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Create Post Modal */}
      <CreatePostModal 
        isOpen={showCreatePost} 
        onClose={() => setShowCreatePost(false)}
        onSuccess={() => {
          setToastMessage('Post created successfully!');
          setShowToast(true);
        }}
      />
      
      {/* Create Board Modal */}
      <CreateBoardModal 
        isOpen={showCreateBoard} 
        onClose={() => setShowCreateBoard(false)}
        onSuccess={() => {
          setToastMessage('Board created successfully!');
          setShowToast(true);
        }}
      />
      
      {/* Search Modal */}
      <SearchModal 
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onPostClick={(post) => {
          setSelectedPost(post);
          setCurrentView('post');
        }}
        onBoardClick={(board) => {
          setSelectedBoard(board);
          setCurrentView('board');
        }}
        onUserClick={(userId) => {
          console.log('Navigate to user:', userId);
          // In a real app, this would navigate to the user profile
        }}
        mockPosts={mockPosts}
        mockBoards={mockBoards}
      />
      
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900">NITI</h1>
              
              {/* Search Bar */}
              <button
                onClick={() => setShowSearch(true)}
                className="relative w-96 hidden lg:block text-left"
              >
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <div className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg hover:bg-white hover:border-blue-200 transition-all text-gray-500 cursor-pointer">
                  Search boards, topics, creators...
                </div>
              </button>
            </div>

            <nav className="flex items-center gap-6">
              <button 
                onClick={() => setCurrentView('feed')}
                className={`p-2 rounded-lg transition-colors ${
                  currentView === 'feed' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'
                }`}
              >
                <Home className="w-6 h-6" />
              </button>
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    setShowAuthModal(true);
                  } else {
                    setCurrentView('profile');
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  currentView === 'profile' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'
                }`}
              >
                <User className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setCurrentView('notifications')}
                className={`p-2 rounded-lg transition-colors relative ${
                  currentView === 'notifications' ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-gray-700'
                }`}
              >
                <Bell className="w-6 h-6" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
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

      {/* Conditional View Rendering */}
      {currentView === 'profile' ? (
        <ProfilePage 
          profile={mockUserProfile} 
          isOwnProfile={true}
          onCreatePost={() => setShowCreatePost(true)}
          onCreateBoard={() => setShowCreateBoard(true)}
          onBoardClick={(board) => {
            setSelectedBoard(board);
            setCurrentView('board');
          }}
          onPostClick={(post) => {
            setSelectedPost(post);
            setCurrentView('post');
          }}
        />
      ) : currentView === 'board' && selectedBoard ? (
        <BoardView 
          board={selectedBoard}
          posts={mockPosts.filter(p => p.sourceBoard?.id === selectedBoard.id)}
          onBack={() => setCurrentView('feed')}
          onFollowToggle={(boardId) => {
            console.log('Toggle follow for board:', boardId);
            setToastMessage(selectedBoard.isFollowing ? 'Unfollowed board' : 'Following board!');
            setShowToast(true);
          }}
          onPostClick={(post) => {
            setSelectedPost(post);
            setCurrentView('post');
          }}
        />
      ) : currentView === 'post' && selectedPost ? (
        <PostDetailView 
          post={selectedPost}
          onClose={() => setCurrentView('feed')}
          onBoardClick={(boardIdOrPartial) => {
            // Look up the full board from mockBoards
            const fullBoard = mockBoards.find(b => b.id === (typeof boardIdOrPartial === 'string' ? boardIdOrPartial : boardIdOrPartial.id));
            if (fullBoard) {
              setSelectedBoard(fullBoard);
              setCurrentView('board');
            }
          }}
          relatedPosts={mockPosts.filter(p => p.id !== selectedPost.id && p.sourceBoard?.id === selectedPost.sourceBoard?.id).slice(0, 4)}
        />
      ) : currentView === 'notifications' ? (
        <NotificationsPage 
          onClose={() => setCurrentView('feed')}
        />
      ) : (
        <>
          {/* Main Content - Three Column Layout */}
          <div className="max-w-[1800px] mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Sidebar - Recommended Boards */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    Discover Boards
                  </h2>
                  <Masonry columnsCount={1} gutter="16px">
                    {leftBoards.map((board) => (
                      <BoardPreview
                        key={board.id}
                        board={board}
                        onFollow={handleFollow}
                        onClick={() => {
                          setSelectedBoard(board);
                          setCurrentView('board');
                        }}
                      />
                    ))}
                  </Masonry>
                </div>
              </aside>

              {/* Center Feed */}
              <main className="lg:col-span-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 -mx-6">
                <div className="max-w-2xl mx-auto">
                  {/* Feed Header */}
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-3xl font-semibold text-gray-900 mb-2">
                          Your Feed
                        </h2>
                        <p className="text-gray-600">
                          Curated content from your followed boards and recommended discoveries
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCreatePost(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Create Post</span>
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
                            ? 'Filter by Mood' 
                            : `Mood: ${moodConfigs[selectedMoodFilter].label}`}
                        </span>
                        {selectedMoodFilter !== 'all' && (
                          <span className="text-lg">{moodConfigs[selectedMoodFilter].emoji}</span>
                        )}
                      </button>

                      {/* Mood Filter Dropdown */}
                      {showMoodFilter && (
                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  </div>

                  {/* Posts */}
                  <div className="space-y-0">
                    {filteredPosts.length > 0 ? (
                      filteredPosts.map((post) => (
                        <PostCard key={post.id} post={post} onClick={() => {
                          setSelectedPost(post);
                          setCurrentView('post');
                        }} />
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No posts found with this mood</p>
                        <button
                          onClick={() => setSelectedMoodFilter('all')}
                          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Load More */}
                  {filteredPosts.length > 0 && (
                    <div className="mt-8 text-center">
                      <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md">
                        Load More Content
                      </button>
                    </div>
                  )}
                </div>
              </main>

              {/* Right Sidebar - More Recommended Boards */}
              <aside className="hidden lg:block lg:col-span-3 bg-blue-50/40 rounded-2xl p-6 -mx-6">
                <div className="sticky top-24">
                  <h2 className="text-sm font-semibold text-blue-900/60 uppercase tracking-wide mb-4 px-1">
                    Trending Now
                  </h2>
                  <Masonry columnsCount={1} gutter="16px">
                    {rightBoards.map((board) => (
                      <BoardPreview
                        key={board.id}
                        board={board}
                        onFollow={handleFollow}
                        onClick={() => {
                          setSelectedBoard(board);
                          setCurrentView('board');
                        }}
                      />
                    ))}
                  </Masonry>
                </div>
              </aside>
            </div>
          </div>

          {/* Mobile Board Discovery - Horizontal Scroll */}
          <div className="lg:hidden px-6 pb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Discover Boards
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {mockBoards.map((board) => (
                <div key={board.id} className="flex-shrink-0 w-72">
                  <BoardPreview board={board} onFollow={handleFollow} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}


      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}