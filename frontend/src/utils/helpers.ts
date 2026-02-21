/**
 * Возвращает URL аватара или SVG-заглушку с первой буквой имени пользователя.
 */
export function getAvatarUrl(username: string, avatar: string | null): string {
  if (avatar && avatar !== 'default_avatar.png') {
    return `/static/uploads/avatars/${avatar}`;
  }
  const letter = username[0]?.toUpperCase() ?? '?';
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
  const color = colors[username.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" rx="50"/>
      <text x="50" y="50" font-size="44" font-family="sans-serif" fill="white"
        text-anchor="middle" dy=".35em">${letter}</text>
    </svg>`
  )}`;
}

/**
 * Форматирует дату относительно текущего момента (по-русски).
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} дн. назад`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
