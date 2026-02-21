import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { getAvatarUrl } from '@/utils/helpers';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [interests, setInterests] = useState(user?.interests?.join(', ') || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await api.editProfile({
        interests,
        ...(avatar ? { avatar } : {}),
      });
      setUser(updated);
      setSuccess('Профиль обновлён!');
      setTimeout(() => navigate(`/profile/${updated.username}`), 800);
    } catch (err: any) {
      setError(err.message || 'Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-foreground mb-6">Редактирование профиля</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={preview || getAvatarUrl(user.username, user.avatar)}
              alt={user.username}
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 transition"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="font-medium text-foreground">{user.username}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm text-muted-foreground hover:text-foreground transition mt-0.5"
            >
              Изменить фото
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpg,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Interests */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Интересы
          </label>
          <input
            type="text"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            placeholder="музыка, кино, технологии..."
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Через запятую, до 20 тегов. Влияют на рекомендации.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">{success}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-accent/50 transition"
          >
            Отмена
          </button>
        </div>
      </form>
    </main>
  );
}
