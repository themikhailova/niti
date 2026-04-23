import React from 'react';
import { X, Upload, Image as ImageIcon, Globe, Lock, EyeOff, Search, Plus, Tag, Users, Check, Loader2 } from 'lucide-react';
import { boardsApi, postsApi, usersApi } from '../services/api';
import type { SearchUser } from '../services/api';

interface Collaborator {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: 'owner' | 'editor' | 'contributor';
}

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBoardModal({ isOpen, onClose, onSuccess }: CreateBoardModalProps) {
  const [boardName, setBoardName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'private' | 'unlisted'>('public');
  const [coverImage, setCoverImage] = React.useState<string | null>(null);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [collaborators, setCollaborators] = React.useState<Collaborator[]>([]);
  const [collaboratorSearch, setCollaboratorSearch] = React.useState('');
  const [collaboratorResults, setCollaboratorResults] = React.useState<SearchUser[]>([]);
  const [showCollaboratorSearch, setShowCollaboratorSearch] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Посты пользователя
  const [myPosts, setMyPosts] = React.useState<any[]>([]);
  const [selectedPosts, setSelectedPosts] = React.useState<string[]>([]);
  const [loadingPosts, setLoadingPosts] = React.useState(false);

  // Загружаем посты при открытии
  React.useEffect(() => {
    if (!isOpen) return;
    setLoadingPosts(true);
    postsApi.getMyPosts()
      .then(setMyPosts)
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [isOpen]);

  // Поиск пользователей (debounced)
  React.useEffect(() => {
    if (!collaboratorSearch.trim()) {
      setCollaboratorResults([]);
      return;
    }
    const timer = setTimeout(() => {
      usersApi.search(collaboratorSearch).then(setCollaboratorResults).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [collaboratorSearch]);

  if (!isOpen) return null;

  const resetForm = () => {
    setBoardName('');
    setDescription('');
    setVisibility('public');
    setCoverImage(null);
    setTags([]);
    setTagInput('');
    setCollaborators([]);
    setCollaboratorSearch('');
    setSelectedPosts([]);
    setError('');
  };

  // В CreateBoardModal.tsx, обновите handleSubmit:

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!boardName.trim()) {
      setError('Введите название доски');
      return;
    }

    setLoading(true);
    try {
      const newBoard = await boardsApi.create({
        name:        boardName.trim(),
        description: description.trim(),
        tags,
        isPublic:    visibility === 'public',
        coverImage:  coverImage ? coverImage : undefined,
        post_ids:    selectedPosts.map(Number),
      });
      
      resetForm();
      
      // 👇 После создания доски обновляем посты, чтобы они отображались с новой доской
      // Перезагружаем посты пользователя, чтобы обновить sourceBoard у выбранных постов
      const updatedPosts = await postsApi.getMyPosts();
      setMyPosts(updatedPosts); // Обновляем локальный список постов
      
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания доски');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };
  const removeTag = (t: string) => setTags(tags.filter(tag => tag !== t));
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTag(); }
  };

  const addCollaborator = (user: SearchUser) => {
    if (!collaborators.find(c => c.id === user.id)) {
      setCollaborators([...collaborators, {
        id: user.id,
        name: user.displayName || user.username,
        username: user.username,
        avatar: user.avatar,
        role: 'contributor',
      }]);
    }
    setCollaboratorSearch('');
    setCollaboratorResults([]);
    setShowCollaboratorSearch(false);
  };
  const removeCollaborator = (id: string) => setCollaborators(collaborators.filter(c => c.id !== id));
  const updateCollaboratorRole = (id: string, role: 'editor' | 'contributor') =>
    setCollaborators(collaborators.map(c => c.id === id ? { ...c, role } : c));

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'editor': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'contributor': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const visibilityOptions = [
    { value: 'public' as const, icon: Globe, label: 'Публичная', description: 'Любой может найти и просмотреть доску' },
    { value: 'private' as const, icon: Lock, label: 'Приватная', description: 'Только вы и соавторы имеют доступ' },
    { value: 'unlisted' as const, icon: EyeOff, label: 'По ссылке', description: 'Видна по прямой ссылке, не в поиске' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Создать доску</h2>
              <p className="text-sm text-gray-500 mt-1">Создайте пространство для кураторского контента</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Обложка</label>
                {coverImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={coverImage} alt="Cover preview" className="w-full h-48 object-cover" />
                    <button type="button" onClick={() => setCoverImage(null)}
                      className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md">
                      <X className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">Перетащите изображение или нажмите для выбора</p>
                    <p className="text-sm text-gray-400 mb-3">Рекомендуется: 1200x400px, JPG или PNG</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium">
                      <Upload className="w-4 h-4" />
                      Выбрать файл
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </div>
                )}
              </div>

              {/* Board Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={boardName} onChange={(e) => setBoardName(e.target.value)}
                  placeholder="Например: Вдохновение для дизайна"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="О чём эта доска и какой контент сюда подходит..."
                  rows={4} maxLength={500}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="mt-2 text-sm text-gray-500">{description.length} / 500</p>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Видимость</label>
                <div className="grid grid-cols-1 gap-3">
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = visibility === option.value;
                    return (
                      <button key={option.value} type="button" onClick={() => setVisibility(option.value)}
                        className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                              {option.label}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                          </div>
                          <p className="text-sm text-gray-600">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Posts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Добавить посты сразу
                  {selectedPosts.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {selectedPosts.length} выбрано
                    </span>
                  )}
                </label>
                {loadingPosts ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Загрузка постов...
                  </div>
                ) : myPosts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                    У вас пока нет постов
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                    {myPosts.map((post) => {
                      const isSelected = selectedPosts.includes(String(post.id));
                      const thumb = post.content?.imageUrl || post.image;
                      const text = post.content?.text || post.content?.caption || post.content?.title || '';
                      return (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPosts((prev) =>
                            isSelected ? prev.filter(id => id !== String(post.id)) : [...prev, String(post.id)]
                          )}
                          className={`cursor-pointer border-2 rounded-lg overflow-hidden relative transition-all ${
                            isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-gray-50 flex items-center justify-center p-2">
                              <p className="text-xs text-gray-500 line-clamp-3 text-center">{text}</p>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Можно добавить посты сразу при создании или позже через редактирование доски.
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Теги</label>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map((tag) => (
                      <span key={tag}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                        <Tag className="w-3.5 h-3.5" />
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)}
                          className="hover:text-blue-900 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Напишите тег и нажмите Enter..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">Максимум 10 тегов.</p>
              </div>

              {/* Collaborators */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Соавторы</label>

                {collaborators.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {collaborators.map((c) => (
                      <div key={c.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full ring-2 ring-white" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                          <p className="text-sm text-gray-500">@{c.username}</p>
                        </div>
                        <select value={c.role}
                          onChange={(e) => updateCollaboratorRole(c.id, e.target.value as 'editor' | 'contributor')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(c.role)} focus:outline-none`}>
                          <option value="editor">Редактор</option>
                          <option value="contributor">Участник</option>
                        </select>
                        <button type="button" onClick={() => removeCollaborator(c.id)}
                          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text" value={collaboratorSearch}
                    onChange={(e) => { setCollaboratorSearch(e.target.value); setShowCollaboratorSearch(true); }}
                    onFocus={() => setShowCollaboratorSearch(true)}
                    placeholder="Найти пользователя для добавления..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {showCollaboratorSearch && collaboratorSearch && (
                    <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                      {collaboratorResults.length > 0 ? (
                        collaboratorResults.map((user) => {
                          const alreadyAdded = collaborators.find(c => c.id === user.id);
                          return (
                            <button key={user.id} type="button"
                              onClick={() => !alreadyAdded && addCollaborator(user)}
                              disabled={!!alreadyAdded}
                              className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
                              <div className="flex-1 text-left">
                                <p className="font-medium text-gray-900 text-sm">{user.displayName || user.username}</p>
                                <p className="text-sm text-gray-500">@{user.username}</p>
                              </div>
                              {alreadyAdded ? <span className="text-xs text-gray-500">Добавлен</span> : <Plus className="w-4 h-4 text-blue-600" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">Пользователи не найдены</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">Вы будете указаны владельцем доски</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} disabled={loading}
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                Отмена
              </button>
              <button onClick={handleSubmit} disabled={!boardName.trim() || loading}
                className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {loading ? 'Создание...' : 'Создать доску'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}