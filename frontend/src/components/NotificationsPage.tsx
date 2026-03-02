import React from 'react';
import { 
  Heart, 
  MessageCircle, 
  Users, 
  UserPlus, 
  Bookmark, 
  AtSign, 
  Bell, 
  Check, 
  CheckCheck,
  Filter,
  X,
  MoreHorizontal,
  Trash2,
  Settings
} from 'lucide-react';

type NotificationType = 
  | 'like'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'board_invite'
  | 'board_post'
  | 'save'
  | 'mention'
  | 'milestone';

interface Notification {
  id: string;
  type: NotificationType;
  isRead: boolean;
  timestamp: Date;
  actor?: {
    name: string;
    username: string;
    avatar: string;
  };
  actors?: Array<{
    name: string;
    username: string;
    avatar: string;
  }>;
  content?: {
    text?: string;
    postImage?: string;
    postTitle?: string;
    boardName?: string;
  };
  action?: {
    label: string;
    href: string;
  };
}

interface NotificationsPageProps {
  onClose?: () => void;
}

export function NotificationsPage({ onClose }: NotificationsPageProps) {
  const [filter, setFilter] = React.useState<'all' | NotificationType>('all');
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>(generateMockNotifications());

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'like':
        return { Icon: Heart, color: 'text-red-500', bg: 'bg-red-50' };
      case 'comment':
      case 'reply':
        return { Icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'follow':
        return { Icon: UserPlus, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'board_invite':
      case 'board_post':
        return { Icon: Users, color: 'text-green-500', bg: 'bg-green-50' };
      case 'save':
        return { Icon: Bookmark, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'mention':
        return { Icon: AtSign, color: 'text-indigo-500', bg: 'bg-indigo-50' };
      case 'milestone':
        return { Icon: Bell, color: 'text-pink-500', bg: 'bg-pink-50' };
      default:
        return { Icon: Bell, color: 'text-gray-500', bg: 'bg-gray-50' };
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationText = (notification: Notification) => {
    const actor = notification.actor;
    const actors = notification.actors;
    const content = notification.content;

    switch (notification.type) {
      case 'like':
        if (actors && actors.length > 1) {
          return (
            <>
              <span className="font-semibold text-gray-900">{actors[0].name}</span>
              {' and '}
              <span className="font-semibold text-gray-900">{actors.length - 1} others</span>
              {' liked your post'}
              {content?.postTitle && (
                <span className="text-gray-600"> "{content.postTitle}"</span>
              )}
            </>
          );
        }
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' liked your post'}
            {content?.postTitle && (
              <span className="text-gray-600"> "{content.postTitle}"</span>
            )}
          </>
        );
      
      case 'comment':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' commented on your post: '}
            <span className="text-gray-600">"{content?.text}"</span>
          </>
        );
      
      case 'reply':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' replied to your comment: '}
            <span className="text-gray-600">"{content?.text}"</span>
          </>
        );
      
      case 'follow':
        if (actors && actors.length > 1) {
          return (
            <>
              <span className="font-semibold text-gray-900">{actors[0].name}</span>
              {' and '}
              <span className="font-semibold text-gray-900">{actors.length - 1} others</span>
              {' started following you'}
            </>
          );
        }
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' started following you'}
          </>
        );
      
      case 'board_invite':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' invited you to collaborate on '}
            <span className="font-semibold text-gray-900">{content?.boardName}</span>
          </>
        );
      
      case 'board_post':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' added a post to '}
            <span className="font-semibold text-gray-900">{content?.boardName}</span>
          </>
        );
      
      case 'save':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' saved your post'}
            {content?.postTitle && (
              <span className="text-gray-600"> "{content.postTitle}"</span>
            )}
          </>
        );
      
      case 'mention':
        return (
          <>
            <span className="font-semibold text-gray-900">{actor?.name}</span>
            {' mentioned you: '}
            <span className="text-gray-600">"{content?.text}"</span>
          </>
        );
      
      case 'milestone':
        return (
          <>
            <span className="text-gray-900">Your post reached </span>
            <span className="font-semibold text-gray-900">{content?.text}</span>
          </>
        );
      
      default:
        return <span className="text-gray-700">New notification</span>;
    }
  };

  const filterOptions = [
    { value: 'all' as const, label: 'All Notifications' },
    { value: 'like' as const, label: 'Likes' },
    { value: 'comment' as const, label: 'Comments' },
    { value: 'follow' as const, label: 'Follows' },
    { value: 'board_invite' as const, label: 'Board Invites' },
    { value: 'mention' as const, label: 'Mentions' },
  ];

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-blue-100/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700"
              >
                <Filter className="w-4 h-4" />
                {filterOptions.find(f => f.value === filter)?.label}
              </button>
              
              {showFilterMenu && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 text-sm ${
                        filter === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                      {option.value !== 'all' && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({notifications.filter(n => n.type === option.value).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100/30 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No notifications yet' : `No ${filterOptions.find(f => f.value === filter)?.label.toLowerCase()}`}
            </h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "When you get notifications, they'll appear here"
                : 'Try selecting a different filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map(notification => {
              const { Icon, color, bg } = getNotificationIcon(notification.type);
              const hasMultipleActors = notification.actors && notification.actors.length > 1;

              return (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md group ${
                    notification.isRead 
                      ? 'border-blue-100/30' 
                      : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="p-4 flex gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>

                    {/* Avatar(s) */}
                    {notification.actor && (
                      <img
                        src={notification.actor.avatar}
                        alt={notification.actor.name}
                        className="w-10 h-10 rounded-full ring-2 ring-white flex-shrink-0"
                      />
                    )}
                    {hasMultipleActors && (
                      <div className="flex -space-x-2 flex-shrink-0">
                        {notification.actors!.slice(0, 3).map((actor, idx) => (
                          <img
                            key={actor.username}
                            src={actor.avatar}
                            alt={actor.name}
                            className="w-10 h-10 rounded-full ring-2 ring-white"
                            style={{ zIndex: 3 - idx }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed mb-1">
                        {getNotificationText(notification)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(notification.timestamp)}
                      </p>

                      {/* Action Buttons */}
                      {notification.action && (
                        <div className="mt-3">
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            {notification.action.label}
                          </button>
                        </div>
                      )}

                      {notification.type === 'board_invite' && (
                        <div className="mt-3 flex gap-2">
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            Accept
                          </button>
                          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Post Thumbnail */}
                    {notification.content?.postImage && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <img
                          src={notification.content.postImage}
                          alt="Post"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Actions Menu */}
                    <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>

                    {/* Unread Indicator */}
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data generator
function generateMockNotifications(): Notification[] {
  const now = new Date();
  
  return [
    {
      id: '1',
      type: 'like',
      isRead: false,
      timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
      actors: [
        {
          name: 'Elena Rodriguez',
          username: '@elenarod',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
        },
        {
          name: 'Marcus Chen',
          username: '@marcusc',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
        },
        {
          name: 'Sophia Anderson',
          username: '@sophiaa',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
        },
      ],
      content: {
        postTitle: 'Minimalist Architecture',
        postImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=300&q=80',
      },
    },
    {
      id: '2',
      type: 'comment',
      isRead: false,
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      actor: {
        name: 'Yuki Tanaka',
        username: '@yukitanaka',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
      },
      content: {
        text: 'This is absolutely stunning! Love the composition.',
        postImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80',
      },
    },
    {
      id: '3',
      type: 'board_invite',
      isRead: false,
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      actor: {
        name: 'James Mitchell',
        username: '@jmitchell',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80',
      },
      content: {
        boardName: 'Design Inspiration 2024',
      },
    },
    {
      id: '4',
      type: 'follow',
      isRead: true,
      timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      actors: [
        {
          name: 'Alex Thompson',
          username: '@alexthompson',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&q=80',
        },
        {
          name: 'Maria Garcia',
          username: '@mariagarcia',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&q=80',
        },
      ],
    },
    {
      id: '5',
      type: 'milestone',
      isRead: true,
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      content: {
        text: '1,000 likes!',
        postImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&q=80',
      },
      action: {
        label: 'View Post',
        href: '#',
      },
    },
    {
      id: '6',
      type: 'reply',
      isRead: true,
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      actor: {
        name: 'Sarah Johnson',
        username: '@sarahj',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80',
      },
      content: {
        text: 'Thanks for the insight! Really helpful perspective.',
      },
    },
    {
      id: '7',
      type: 'save',
      isRead: true,
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      actor: {
        name: 'David Lee',
        username: '@davidlee',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&q=80',
      },
      content: {
        postTitle: 'Abstract Color Study',
        postImage: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80',
      },
    },
    {
      id: '8',
      type: 'mention',
      isRead: true,
      timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      actor: {
        name: 'Lisa Wang',
        username: '@lisawang',
        avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&q=80',
      },
      content: {
        text: 'Thought you might find this interesting!',
      },
    },
    {
      id: '9',
      type: 'board_post',
      isRead: true,
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      actor: {
        name: 'Tom Brown',
        username: '@tombrown',
        avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&q=80',
      },
      content: {
        boardName: 'Nature Photography',
        postImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80',
      },
    },
    {
      id: '10',
      type: 'like',
      isRead: true,
      timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      actor: {
        name: 'Emma Wilson',
        username: '@emmawilson',
        avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&q=80',
      },
      content: {
        postTitle: 'Urban Exploration',
        postImage: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=300&q=80',
      },
    },
  ];
}
