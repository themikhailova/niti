import React from 'react';
import { X, Image as ImageIcon, Bold, Italic, List, Upload, Tag, Globe, Users, Smile } from 'lucide-react';
import { moodConfigs, type MoodType } from '../data/mock-data';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [selectedBoard, setSelectedBoard] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'followers'>('public');
  const [selectedMood, setSelectedMood] = React.useState<MoodType | null>(null);
  const [showMoodSelector, setShowMoodSelector] = React.useState(false);
  const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Character counter
  const maxChars = 5000;
  const charCount = content.length;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!content.trim() && !uploadedImage) {
      alert('Please add some content or an image to your post');
      return;
    }

    // In a real app, this would submit to backend
    console.log('Creating post:', {
      title,
      content,
      board: selectedBoard,
      tags,
      visibility,
      mood: selectedMood,
      image: uploadedImage,
    });

    // Reset form
    setTitle('');
    setContent('');
    setSelectedBoard('');
    setTags([]);
    setTagInput('');
    setVisibility('public');
    setSelectedMood(null);
    setUploadedImage(null);
    
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
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTag();
    }
  };

  const selectedMoodConfig = selectedMood ? moodConfigs[selectedMood] : null;

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
            <h2 className="text-2xl font-semibold text-gray-900">Create New Post</h2>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Content Input */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Title Field */}
                  <div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Post title (optional)"
                      className="w-full px-0 py-2 text-2xl font-semibold text-gray-900 placeholder-gray-400 border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Main Content Textarea */}
                  <div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="What's on your mind? Share your thoughts, story or idea..."
                      rows={10}
                      maxLength={maxChars}
                      className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-2">
                        {/* Simple formatting hints */}
                        <span className="text-xs text-gray-500">
                          Tip: Use **bold** or *italic* for emphasis
                        </span>
                      </div>
                      <span className={`text-sm ${charCount > maxChars * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {charCount} / {maxChars}
                      </span>
                    </div>
                  </div>

                  {/* Image Upload Area */}
                  <div>
                    {uploadedImage ? (
                      <div className="relative rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={uploadedImage}
                          alt="Upload preview"
                          className="w-full h-64 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setUploadedImage(null)}
                          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md"
                        >
                          <X className="w-5 h-5 text-gray-700" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">
                          Drag & drop an image here, or click to upload
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
                </div>

                {/* Right Column - Metadata */}
                <div className="space-y-6">
                  {/* Board Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add to Board
                    </label>
                    <select
                      value={selectedBoard}
                      onChange={(e) => setSelectedBoard(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    >
                      <option value="">Select a board...</option>
                      <option value="b1">🎨 Minimalist Aesthetics</option>
                      <option value="b2">🏞️ Natural Landscapes</option>
                      <option value="b3">🌿 Botanical Studies</option>
                      <option value="b4">📚 Editorial Design</option>
                      <option value="b5">✨ Creative Inspiration</option>
                    </select>
                  </div>

                  {/* Mood Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Set the Mood
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowMoodSelector(!showMoodSelector)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showMoodSelector ? 'Hide' : 'Choose'}
                      </button>
                    </div>

                    {selectedMoodConfig && (
                      <div 
                        className="mb-3 flex items-center gap-3 p-3 rounded-lg border"
                        style={{ 
                          borderColor: selectedMoodConfig.color + '40',
                          backgroundColor: selectedMoodConfig.pastelBg
                        }}
                      >
                        <span className="text-2xl">{selectedMoodConfig.emoji}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm" style={{ color: selectedMoodConfig.color }}>
                            {selectedMoodConfig.label}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMood(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {showMoodSelector && (
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(moodConfigs) as MoodType[]).map((moodKey) => {
                          const mood = moodConfigs[moodKey];
                          const isSelected = selectedMood === moodKey;
                          
                          return (
                            <button
                              key={moodKey}
                              type="button"
                              onClick={() => {
                                setSelectedMood(moodKey);
                                setShowMoodSelector(false);
                              }}
                              className={`p-3 rounded-lg border transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">{mood.emoji}</span>
                                <span className="font-medium text-xs text-gray-700">
                                  {mood.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tags Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="space-y-2">
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="hover:text-blue-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type tag and press Enter..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Visibility Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          visibility === 'public'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span className="font-medium text-sm">Public</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('followers')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          visibility === 'followers'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span className="font-medium text-sm">Followers</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() && !uploadedImage}
              className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              Publish
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
