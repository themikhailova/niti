import React from 'react';
import { X, Upload, Image as ImageIcon, Globe, Lock, EyeOff, Search, Plus, Tag, Users, Check } from 'lucide-react';
import type { Board } from '../data/mock-data';

interface Collaborator {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: 'owner' | 'editor' | 'contributor';
}

interface EditBoardModalProps {
  isOpen: boolean;
  board: Board;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditBoardModal({ isOpen, board, onClose, onSuccess }: EditBoardModalProps) {
  const [boardName, setBoardName] = React.useState(board.name);
  const [description, setDescription] = React.useState(board.description);
  const [visibility, setVisibility] = React.useState<'public' | 'private' | 'unlisted'>(
    board.isPrivate ? 'private' : 'public'
  );
  const [coverImage, setCoverImage] = React.useState<string | null>(board.coverImage);
  const [tags, setTags] = React.useState<string[]>(board.tags || []);
  const [tagInput, setTagInput] = React.useState('');
  const [collaborators, setCollaborators] = React.useState<Collaborator[]>([]);
  const [collaboratorSearch, setCollaboratorSearch] = React.useState('');
  const [showCollaboratorSearch, setShowCollaboratorSearch] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Mock user search results (in real app, would come from API)
  const mockSearchResults = [
    { id: '1', name: 'Elena Rodriguez', username: '@elenarod', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' },
    { id: '2', name: 'Marcus Chen', username: '@marcusc', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80' },
    { id: '3', name: 'Sophia Anderson', username: '@sophiaa', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' },
    { id: '4', name: 'Yuki Tanaka', username: '@yukitanaka', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80' },
    { id: '5', name: 'James Mitchell', username: '@jmitchell', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' },
  ];

  const filteredSearchResults = collaboratorSearch
    ? mockSearchResults.filter(
        user =>
          user.name.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
          user.username.toLowerCase().includes(collaboratorSearch.toLowerCase())
      )
    : mockSearchResults;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!boardName.trim()) {
      alert('Please enter a board name');
      return;
    }

    // In a real app, this would submit to backend
    console.log('Updating board:', {
      boardId: board.id,
      boardName,
      description,
      visibility,
      coverImage,
      tags,
      collaborators,
    });
    
    onSuccess();
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTag();
    }
  };

  const addCollaborator = (user: typeof mockSearchResults[0], role: 'editor' | 'contributor' = 'contributor') => {
    if (!collaborators.find(c => c.id === user.id)) {
      setCollaborators([
        ...collaborators,
        {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          role,
        },
      ]);
      setCollaboratorSearch('');
      setShowCollaboratorSearch(false);
    }
  };

  const removeCollaborator = (userId: string) => {
    setCollaborators(collaborators.filter(c => c.id !== userId));
  };

  const updateCollaboratorRole = (userId: string, newRole: 'editor' | 'contributor') => {
    setCollaborators(
      collaborators.map(c => (c.id === userId ? { ...c, role: newRole } : c))
    );
  };

  const visibilityOptions = [
    {
      value: 'public' as const,
      icon: Globe,
      label: 'Public',
      description: 'Anyone can discover and view this board',
    },
    {
      value: 'private' as const,
      icon: Lock,
      label: 'Private',
      description: 'Only you and invited collaborators can access',
    },
    {
      value: 'unlisted' as const,
      icon: EyeOff,
      label: 'Unlisted',
      description: 'Anyone with the link can view, but not discoverable',
    },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'editor':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'contributor':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Edit Board</h2>
              <p className="text-sm text-gray-500 mt-1">
                Update your board settings and details
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-8">
                {/* Cover Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Cover Image
                  </label>
                  {coverImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        className="w-full h-48 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setCoverImage(null)}
                        className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md"
                      >
                        <X className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md text-sm font-medium text-gray-700"
                      >
                        <Upload className="w-4 h-4" />
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">
                        Drag & drop a cover image, or click to upload
                      </p>
                      <p className="text-sm text-gray-400 mb-3">
                        Recommended: 1200x400px, JPG or PNG
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Board Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Board Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="e.g., Minimalist Design Inspiration"
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this board is about and what kind of content belongs here..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    {description.length} / 500 characters
                  </p>
                </div>

                {/* Visibility Settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Visibility
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {visibilityOptions.map((option) => {
                      const Icon = option.icon;
                      const isSelected = visibility === option.value;
                      
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setVisibility(option.value)}
                          className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              isSelected ? 'text-blue-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium ${
                                isSelected ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {option.label}
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {option.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add a tag..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Press Enter to add a tag
                  </p>
                </div>

                {/* Collaborators */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Collaborators
                  </label>
                  
                  {/* Current Collaborators */}
                  {collaborators.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {collaborators.map((collaborator) => (
                        <div
                          key={collaborator.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={collaborator.avatar}
                              alt={collaborator.name}
                              className="w-10 h-10 rounded-full ring-2 ring-blue-100"
                            />
                            <div>
                              <p className="font-medium text-gray-900">{collaborator.name}</p>
                              <p className="text-sm text-gray-600">{collaborator.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={collaborator.role}
                              onChange={(e) =>
                                updateCollaboratorRole(
                                  collaborator.id,
                                  e.target.value as 'editor' | 'contributor'
                                )
                              }
                              disabled={collaborator.role === 'owner'}
                              className={`px-3 py-1.5 text-sm rounded-lg border font-medium ${getRoleBadgeColor(
                                collaborator.role
                              )} ${
                                collaborator.role === 'owner'
                                  ? 'cursor-not-allowed'
                                  : 'cursor-pointer hover:opacity-80'
                              }`}
                            >
                              {collaborator.role === 'owner' && (
                                <option value="owner">Owner</option>
                              )}
                              <option value="editor">Editor</option>
                              <option value="contributor">Contributor</option>
                            </select>
                            {collaborator.role !== 'owner' && (
                              <button
                                type="button"
                                onClick={() => removeCollaborator(collaborator.id)}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Collaborator */}
                  <div className="relative">
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={collaboratorSearch}
                        onChange={(e) => {
                          setCollaboratorSearch(e.target.value);
                          setShowCollaboratorSearch(true);
                        }}
                        onFocus={() => setShowCollaboratorSearch(true)}
                        placeholder="Search users to add as collaborators..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {showCollaboratorSearch && filteredSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredSearchResults.map((user) => {
                          const alreadyAdded = collaborators.find(c => c.id === user.id);
                          
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => !alreadyAdded && addCollaborator(user)}
                              disabled={!!alreadyAdded}
                              className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-10 h-10 rounded-full ring-2 ring-blue-100"
                                />
                                <div className="text-left">
                                  <p className="font-medium text-gray-900">{user.name}</p>
                                  <p className="text-sm text-gray-600">{user.username}</p>
                                </div>
                              </div>
                              {alreadyAdded ? (
                                <span className="text-sm text-gray-500">Added</span>
                              ) : (
                                <Plus className="w-5 h-5 text-blue-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Collaborators can contribute content to this board
                  </p>
                </div>
              </div>

              {/* Footer - Sticky at bottom */}
              <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="px-6 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    Delete Board
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
