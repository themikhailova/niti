import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { usersApi } from '../services/api';
import type { SearchUser } from '../services/api';
import { Avatar } from './Avatar';

type Tab = 'followers' | 'following';

interface FollowersModalProps {
  username: string;          // без @
  displayName: string;
  initialTab?: Tab;
  followersCount: number;
  followingCount: number;
  isAuthenticated: boolean;
  currentUsername?: string;  // без @
  onClose: () => void;
  onUserClick: (username: string) => void;
  onRequireAuth: () => void;
  /** Вызывается когда меняется счётчик подписок текущего юзера */
  onFollowingCountChange?: (delta: number) => void;
  /** Вызывается когда меняется счётчик подписчиков профиля (при follow/unfollow в модале) */
  onFollowersCountChange?: (delta: number) => void;
  /** Инкремент — при смене значения модал перезагружает список */
  reloadKey?: number;
}

export function FollowersModal({
  username,
  displayName,
  initialTab = 'followers',
  followersCount,
  followingCount,
  isAuthenticated,
  currentUsername,
  onClose,
  onUserClick,
  onRequireAuth,
  onFollowingCountChange,
  onFollowersCountChange,
  reloadKey = 0,
}: FollowersModalProps) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [users, setUsers] = React.useState<SearchUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [followMap, setFollowMap] = React.useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = React.useState<Record<string, boolean>>({});
  // Локальные счётчики для мгновенного обновления
  const [localFollowersCount, setLocalFollowersCount] = React.useState(followersCount);
  const [localFollowingCount, setLocalFollowingCount] = React.useState(followingCount);

  const load = React.useCallback(async (t: Tab, p: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = t === 'followers'
        ? await usersApi.getFollowers(username, p)
        : await usersApi.getFollowing(username, p);

      setUsers((prev) => replace ? res.users : [...prev, ...res.users]);
      setHasMore(res.has_more);
      setPage(p);

      // Инициализируем карту подписок
      setFollowMap((prev) => {
        const next = { ...prev };
        res.users.forEach((u) => { next[u.id] = u.isFollowing; });
        return next;
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Синхронизируем счётчики с пропсами
  React.useEffect(() => { setLocalFollowersCount(followersCount); }, [followersCount]);
  React.useEffect(() => { setLocalFollowingCount(followingCount); }, [followingCount]);

  // При смене таба или reloadKey — перезагружаем список
  React.useEffect(() => {
    setUsers([]);
    setPage(1);
    load(tab, 1, true);
  }, [tab, load, reloadKey]);

  // Закрытие по Escape
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleFollowToggle = async (e: React.MouseEvent, user: SearchUser) => {
    e.stopPropagation();
    if (!isAuthenticated) { onRequireAuth(); return; }

    const raw = user.username.startsWith('@') ? user.username.slice(1) : user.username;
    const cur = followMap[user.id] ?? user.isFollowing;

    // Optimistic update
    setFollowLoading((p) => ({ ...p, [user.id]: true }));
    setFollowMap((p) => ({ ...p, [user.id]: !cur }));

    // Обновляем счётчик подписок текущего пользователя (его own following count)
    onFollowingCountChange?.(cur ? -1 : 1);

    if (tab === 'following') {
      // Вкладка «Подписки»: отписались — убираем из списка
      if (cur) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setLocalFollowingCount((c) => Math.max(0, c - 1));
      }
    }

    if (tab === 'followers') {
      // Вкладка «Подписчики»: подписались/отписались — меняем счётчик профиля
      // Нет: подписчики профиля — это люди которые подписаны НА него, не мы.
      // Здесь мы подписываемся на людей из списка — это их followers count меняется, не профиля.
    }

    try {
      if (cur) { await usersApi.unfollow(raw); }
      else { await usersApi.follow(raw); }
    } catch {
      // Откат
      setFollowMap((p) => ({ ...p, [user.id]: cur }));
      onFollowingCountChange?.(cur ? 1 : -1);
      if (tab === 'following' && cur) {
        setUsers((prev) => [...prev, user]);
        setLocalFollowingCount((c) => c + 1);
      }
    } finally {
      setFollowLoading((p) => ({ ...p, [user.id]: false }));
    }
  };

  const tabCount = tab === 'followers' ? followersCount : followingCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 px-1">
          {(['followers', 'following'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t === 'followers' ? 'Подписчики' : 'Подписки'}
              <span className={`ml-1.5 text-xs ${tab === t ? 'text-blue-500' : 'text-gray-400'}`}>
                {t === 'followers' ? localFollowersCount : localFollowingCount}
              </span>
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading && users.length === 0 ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">
                {tab === 'followers' ? 'Подписчиков пока нет' : 'Подписок пока нет'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {users.map((user) => {
                const raw = user.username.startsWith('@') ? user.username.slice(1) : user.username;
                const isSelf = currentUsername === raw;
                const isFollowing = followMap[user.id] ?? user.isFollowing;
                const isLoadingFollow = followLoading[user.id] ?? false;

                return (
                  <li
                    key={user.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => { onUserClick(raw); onClose(); }}
                  >
                    <Avatar
                      src={user.avatar}
                      username={user.displayName}
                      size={44}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.username}</p>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={(e) => handleFollowToggle(e, user)}
                        disabled={isLoadingFollow}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          isFollowing
                            ? 'bg-gray-100 border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isLoadingFollow
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : isFollowing ? 'Отписаться' : 'Подписаться'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <div className="px-5 py-3">
              <button
                onClick={() => load(tab, page + 1, false)}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Загрузить ещё
              </button>
            </div>
          )}
          {loading && users.length > 0 && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}