import React from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  username?: string;
  className?: string;
  size?: number; // px, используется только для fallback SVG
}

/**
 * Универсальный компонент аватарки.
 * - Если src — валидный URL или data URI → показывает картинку
 * - Если src пустой / сломанный / default_avatar.png → показывает цветной круг с буквой
 * - onError → автоматически переключается на fallback
 */
export function Avatar({ src, alt, username, className = '', size = 40 }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);

  // Определяем нужен ли fallback сразу (без попытки загрузки)
  const isDefaultOrEmpty =
    !src ||
    src === 'default_avatar.png' ||
    src.endsWith('/default_avatar.png') ||
    src === '';

  const showFallback = failed || isDefaultOrEmpty;

  // Первая буква для fallback
  const letter = (username || alt || '?')[0]?.toUpperCase() ?? '?';

  // Сбрасываем ошибку при смене src
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (showFallback) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-blue-500 text-white font-semibold select-none flex-shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-label={alt || username || 'Аватар'}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || username || 'Аватар'}
      className={`rounded-full object-cover flex-shrink-0 ${className}`}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
    />
  );
}