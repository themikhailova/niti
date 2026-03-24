import React from 'react';
import { X, Camera, MapPin, Link as LinkIcon, Check, Loader2 } from 'lucide-react';
import type { UserProfile } from '../data/mock-data';
import { usersApi } from '../services/api';
import type { AuthUser } from '../services/api';

interface EditProfileModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  /** Вызывается после успешного сохранения с обновлёнными данными пользователя */
  onSaved?: (user: AuthUser) => void;
}

export function EditProfileModal({ isOpen, profile, onClose, onSaved }: EditProfileModalProps) {
  const [displayName, setDisplayName] = React.useState(profile.displayName);
  // username без символа «@»
  const rawUsername = profile.username.startsWith('@')
    ? profile.username.slice(1)
    : profile.username;
  const [username, setUsername] = React.useState(rawUsername);
  const [bio, setBio] = React.useState(profile.bio);
  const [avatarPreview, setAvatarPreview] = React.useState(profile.avatar);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = React.useState(false);

  const [isValidUsername, setIsValidUsername] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateUsername = (value: string): boolean => {
    const clean = value.startsWith('@') ? value.slice(1) : value;
    const valid = /^[a-zA-Z0-9_]{3,30}$/.test(clean);
    setIsValidUsername(valid);
    return valid;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    validateUsername(e.target.value);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой (максимум 5 МБ)');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!validateUsername(cleanUsername)) return;
    if (!displayName.trim()) {
      setError('Имя не может быть пустым');
      return;
    }

    setLoading(true);
    try {
      // 1. Обновляем username и bio
      const updated = await usersApi.updateProfile({
        username: cleanUsername,
        bio,
      });

      // 2. Если выбран новый аватар — загружаем отдельным запросом
      let finalUser = updated;
      if (avatarFile) {
        const avatarRes = await usersApi.uploadAvatar(avatarFile);
        finalUser = { ...updated, avatar: avatarRes.avatar_url };
        setAvatarPreview(avatarRes.avatar_url);
        setAvatarFile(null);
        setAvatarRemoved(false);
      }

      // 3. Если аватар был удалён — вызываем DELETE
      if (avatarRemoved && !avatarFile) {
        const res = await usersApi.removeAvatar();
        finalUser = { ...finalUser, avatar: res.avatar_url };
        setAvatarRemoved(false);
      }

      // onSaved уведомляет родителя; родитель сам закрывает модал
      onSaved?.(finalUser);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Редактировать профиль</h2>
              <p className="text-sm text-gray-600 mt-1">Обновите информацию о себе</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* Avatar */}
              <div className="flex flex-col items-center p-6 bg-gradient-to-b from-blue-50 to-white rounded-xl border border-blue-100/50">
                <div className="relative mb-3 group/avatar">
                  <img
                    src={avatarPreview}
                    alt="Аватар"
                    className="w-28 h-28 rounded-full ring-4 ring-white shadow-lg object-cover"
                  />
                  {/* Кнопка смены аватара */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {/* Кнопка удаления аватара — появляется при наведении, только если не дефолтный */}
                  {!avatarRemoved && avatarFile === null && !avatarPreview.startsWith('data:image/svg') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarRemoved(true);
                        setAvatarFile(null);
                        // Показываем дефолтный SVG-аватар (первая буква имени)
                        const letter = (profile.displayName || profile.username || '?')[0].toUpperCase();
                        setAvatarPreview(
                          `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='50' font-size='40' fill='white' text-anchor='middle' dy='.3em'%3E${letter}%3C/text%3E%3C/svg%3E`
                        );
                      }}
                      title="Удалить фото"
                      className="absolute top-0 right-0 w-6 h-6 bg-gray-800/70 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">
                  JPG, PNG, GIF или WebP · макс. 5 МБ
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Отображаемое имя *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Ваше имя"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Публичное имя на профиле</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Имя пользователя *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isValidUsername
                        ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    }`}
                    placeholder="username"
                  />
                  {username && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidUsername ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {!isValidUsername && (
                  <p className="mt-1 text-xs text-red-600">
                    3–30 символов: латиница, цифры, подчёркивание
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={300}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                  placeholder="Расскажите о себе..."
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">Краткое описание для профиля</p>
                  <p className="text-xs text-gray-400">{bio.length} / 300</p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !displayName.trim() || !isValidUsername}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}