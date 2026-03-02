import React from 'react';
import { X, Search, TrendingUp, Clock, Hash, Users } from 'lucide-react';
import type { Post, Board, MoodType } from '../data/mock-data';
import { moodConfigs } from '../data/mock-data';

interface SearchResult {
  posts: Post[];
  boards: Board[];
  users: Array<{
    id: string;
    name: string;
    username: string;
    avatar: string;
    followers: number;
  }>;
  tags: string[];
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostClick?: (post: Post) => void;
  onBoardClick?: (board: Board) => void;
  onUserClick?: (userId: string) => void;
  mockPosts?: Post[];
  mockBoards?: Board[];
}

export function SearchModal({ 
  isOpen, 
  onClose, 
  onPostClick, 
  onBoardClick, 
  onUserClick,
  mockPosts = [],
  mockBoards = []
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'all' | 'posts' | 'boards' | 'users' | 'tags'>('all');
  const [recentSearches] = React.useState<string[]>([
    'minimalist design',
    'nature photography',
    'abstract art',
  ]);

  const [trendingSearches] = React.useState<string[]>([
    'spring aesthetics',
    'urban exploration',
    'botanical illustrations',
    'editorial layouts',
    'peaceful moods',
  ]);

  // Mock users data
  const mockUsers = [
    {
      id: 'u1',
      name: 'Elena Rodriguez',
      username: '@elenarod',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
      followers: 15400,
    },
    {
      id: 'u2',
      name: 'Marcus Chen',
      username: '@marcusc',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
      followers: 28900,
    },
    {
      id: 'u3',
      name: 'Sophia Anderson',
      username: '@sophiaa',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
      followers: 12100,
    },
  ];

  // Filter results based on search query
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return { posts: [], boards: [], users: [], tags: [] };
    }

    const query = searchQuery.toLowerCase();

    const posts = mockPosts.filter(post =>
      post.content.title?.toLowerCase().includes(query) ||
      post.content.caption?.toLowerCase().includes(query) ||
      post.content.text?.toLowerCase().includes(query) ||
      post.tags?.some(tag => tag.toLowerCase().includes(query))
    );

    const boards = mockBoards.filter(board =>
      board.name.toLowerCase().includes(query) ||
      board.description.toLowerCase().includes(query) ||
      board.tags?.some(tag => tag.toLowerCase().includes(query))
    );

    const users = mockUsers.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query)
    );

    // Extract unique tags from posts and boards
    const allTags = new Set<string>();
    mockPosts.forEach(post => {
      post.tags?.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          allTags.add(tag);
        }
      });
    });
    mockBoards.forEach(board => {
      board.tags?.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          allTags.add(tag);
        }
      });
    });

    return {
      posts: posts.slice(0, 10),
      boards: boards.slice(0, 8),
      users: users.slice(0, 6),
      tags: Array.from(allTags).slice(0, 10),
    };
  }, [searchQuery, mockPosts, mockBoards]);

  const hasResults = searchQuery.trim() && (
    searchResults.posts.length > 0 ||
    searchResults.boards.length > 0 ||
    searchResults.users.length > 0 ||
    searchResults.tags.length > 0
  );

  const getFilteredResults = () => {
    switch (activeTab) {
      case 'posts':
        return { posts: searchResults.posts, boards: [], users: [], tags: [] };
      case 'boards':
        return { posts: [], boards: searchResults.boards, users: [], tags: [] };
      case 'users':
        return { posts: [], boards: [], users: searchResults.users, tags: [] };
      case 'tags':
        return { posts: [], boards: [], users: [], tags: searchResults.tags };
      default:
        return searchResults;
    }
  };

  const filteredResults = getFilteredResults();
  const totalResults = searchResults.posts.length + searchResults.boards.length + 
                       searchResults.users.length + searchResults.tags.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative h-full flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
          {/* Search Header */}
          <div className="relative border-b border-gray-200">
            <div className="flex items-center gap-3 px-6 py-4">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts, boards, users, or tags..."
                autoFocus
                className="flex-1 text-lg outline-none placeholder:text-gray-400"
              />
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Tabs */}
            {searchQuery.trim() && (
              <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All ({totalResults})
                </button>
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'posts'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Posts ({searchResults.posts.length})
                </button>
                <button
                  onClick={() => setActiveTab('boards')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'boards'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Boards ({searchResults.boards.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Users ({searchResults.users.length})
                </button>
                <button
                  onClick={() => setActiveTab('tags')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'tags'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Tags ({searchResults.tags.length})
                </button>
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!searchQuery.trim() ? (
              <div className="p-6 space-y-6">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-900 text-sm">Recent Searches</h3>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((search, index) => (
                        <button
                          key={index}
                          onClick={() => setSearchQuery(search)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700 flex-1">{search}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Searches */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 text-sm">Trending</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => setSearchQuery(search)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : hasResults ? (
              <div className="p-6 space-y-6">
                {/* Posts Results */}
                {filteredResults.posts.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Posts</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {filteredResults.posts.map((post) => {
                        const postMoodConfig = post.mood ? moodConfigs[post.mood] : null;
                        
                        return (
                          <button
                            key={post.id}
                            onClick={() => {
                              onPostClick?.(post);
                              onClose();
                            }}
                            className="rounded-lg overflow-hidden group border border-gray-200 hover:shadow-md transition-all"
                            style={{ backgroundColor: postMoodConfig?.pastelBg || '#ffffff' }}
                          >
                            {post.content.imageUrl ? (
                              <div className="relative aspect-square overflow-hidden">
                                <img
                                  src={post.content.imageUrl}
                                  alt={post.content.title || 'Post'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                {postMoodConfig && (
                                  <div className="absolute top-2 left-2">
                                    <span className="text-lg drop-shadow-md">{postMoodConfig.emoji}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="aspect-square p-3 flex flex-col justify-center">
                                {postMoodConfig && (
                                  <span className="text-xl mb-1">{postMoodConfig.emoji}</span>
                                )}
                                <p className="text-xs font-medium text-gray-900 line-clamp-3 text-left">
                                  {post.content.title || post.content.text}
                                </p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Boards Results */}
                {filteredResults.boards.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Boards</h3>
                    <div className="space-y-2">
                      {filteredResults.boards.map((board) => (
                        <button
                          key={board.id}
                          onClick={() => {
                            onBoardClick?.(board);
                            onClose();
                          }}
                          className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                        >
                          <img
                            src={board.coverImage}
                            alt={board.name}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{board.name}</h4>
                            <p className="text-sm text-gray-600 line-clamp-1">{board.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{(board.followers / 1000).toFixed(1)}k followers</span>
                              <span>•</span>
                              <span>{board.postCount} posts</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users Results */}
                {filteredResults.users.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Users</h3>
                    <div className="space-y-2">
                      {filteredResults.users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            onUserClick?.(user.id);
                            onClose();
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-12 h-12 rounded-full ring-2 ring-blue-100"
                            />
                            <div className="text-left">
                              <p className="font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-600">{user.username}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {(user.followers / 1000).toFixed(1)}k followers
                              </p>
                            </div>
                          </div>
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                            Follow
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags Results */}
                {filteredResults.tags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Tags</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filteredResults.tags.map((tag, index) => (
                        <button
                          key={index}
                          onClick={() => setSearchQuery(tag)}
                          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500 text-sm">
                  Try searching with different keywords or explore trending topics
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
