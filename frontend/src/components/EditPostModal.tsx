import React from 'react';
import { X, Image as ImageIcon, Bold, Italic, List, Upload, Tag, Globe, Users, Smile } from 'lucide-react';
import { moodConfigs, type MoodType, type Post } from '../data/mock-data';

interface EditPostModalProps {
  isOpen: boolean;
  post: Post;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPostModal({ isOpen, post, onClose, onSuccess }: EditPostModalProps) {
  const [title, setTitle] = React.useState(post.content.title || '');
  const [content, setContent] = React.useState(post.content.text || post.content.caption || '');
  const [selectedBoard, setSelectedBoard] = React.useState(post.sourceBoard?.id || '');
  const [tags, setTags] = React.useState<string[]>(post.tags || []);
  const [tagInput, setTagInput] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'followers'>('public');
  const [selectedMood, setSelectedMood] = React.useState<MoodType | null>(post.mood || null);
  const [showMoodSelector, setShowMoodSelector] = React.useState(false);
  const [uploadedImage, setUploadedImage] = React.useState<string | null>(post.content.imageUrl || null);
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
    console.log('Updating post:', {
      postId: post.id,
      title,
      content,
      board: selectedBoard,
      tags,
      visibility,
      mood: selectedMood,
      image: uploadedImage,
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
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Edit Post</h2>
              <p className="text-sm text-gray-500 mt-1">
                Update your post content and settings
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Content Input */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Title Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Give your post a title..."
                      className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Main Content Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Share your thoughts, insights, or discoveries..."
                      rows={12}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-light leading-relaxed"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Bold"
                        >
                          <Bold className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Italic"
                        >
                          <Italic className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="List"
                        >
                          <List className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      <p className={`text-sm ${charCount > maxChars ? 'text-red-500' : 'text-gray-500'}`}>
                        {charCount} / {maxChars}
                      </p>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Attach Image (Optional)
                    </label>
                    {uploadedImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200">
                        <img
                          src={uploadedImage}
                          alt="Uploaded"
                          className="w-full max-h-96 object-contain bg-gray-50"
                        />
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md"
                          >
                            <Upload className="w-5 h-5 text-gray-700" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadedImage(null)}
                            className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-md"
                          >
                            <X className="w-5 h-5 text-gray-700" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">
                          Drag & drop an image, or click to upload
                        </p>
                        <p className="text-sm text-gray-400">
                          PNG, JPG, GIF up to 10MB
                        </p>
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

                {/* Right Column - Settings & Metadata */}
                <div className="space-y-6">
                  {/* Board Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Board
                    </label>
                    <select
                      value={selectedBoard}
                      onChange={(e) => setSelectedBoard(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="">Select a board...</option>
                      <option value="design">Design Inspiration</option>
                      <option value="architecture">Architecture</option>
                      <option value="nature">Nature & Landscapes</option>
                      <option value="art">Abstract Art</option>
                      <option value="photography">Photography</option>
                      <option value="minimal">Minimalism</option>
                    </select>
                    <p className="mt-2 text-sm text-gray-500">
                      Choose where this post will appear
                    </p>
                  </div>

                  {/* Mood Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mood
                    </label>
                    {selectedMoodConfig ? (
                      <div
                        className="relative p-4 rounded-lg border-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: selectedMoodConfig.pastelBg,
                          borderColor: selectedMoodConfig.borderColor,
                        }}
                        onClick={() => setShowMoodSelector(!showMoodSelector)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{selectedMoodConfig.emoji}</span>
                            <div>
                              <p 
                                className="font-medium"
                                style={{ color: selectedMoodConfig.color }}
                              >
                                {selectedMoodConfig.label}
                              </p>
                              <p className="text-xs text-gray-600">
                                {selectedMoodConfig.description}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMood(null);
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                          >
                            <X className="w-4 h-4" style={{ color: selectedMoodConfig.color }} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowMoodSelector(!showMoodSelector)}
                        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                      >
                        <Smile className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-600">Add a mood</span>
                      </button>
                    )}

                    {/* Mood Selector Dropdown */}
                    {showMoodSelector && (
                      <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                          {(Object.keys(moodConfigs) as MoodType[]).map((moodKey) => {
                            const mood = moodConfigs[moodKey];
                            
                            return (
                              <button
                                key={moodKey}
                                type="button"
                                onClick={() => {
                                  setSelectedMood(moodKey);
                                  setShowMoodSelector(false);
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                style={{
                                  backgroundColor: selectedMood === moodKey ? mood.pastelBg : undefined,
                                }}
                              >
                                <span className="text-xl flex-shrink-0">{mood.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm">
                                    {mood.label}
                                  </p>
                                  <p className="text-xs text-gray-600 line-clamp-1">
                                    {mood.description}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                      Express the feeling of your post
                    </p>
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
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
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
                          onKeyDown={handleKeyDown}
                          placeholder="Add a tag..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Press Enter to add
                    </p>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          visibility === 'public'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Globe className={`w-5 h-5 ${
                          visibility === 'public' ? 'text-blue-600' : 'text-gray-500'
                        }`} />
                        <div className="flex-1 text-left">
                          <p className={`font-medium text-sm ${
                            visibility === 'public' ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            Public
                          </p>
                          <p className="text-xs text-gray-600">
                            Anyone can see this post
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('followers')}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          visibility === 'followers'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Users className={`w-5 h-5 ${
                          visibility === 'followers' ? 'text-blue-600' : 'text-gray-500'
                        }`} />
                        <div className="flex-1 text-left">
                          <p className={`font-medium text-sm ${
                            visibility === 'followers' ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            Followers Only
                          </p>
                          <p className="text-xs text-gray-600">
                            Only your followers can see
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer - Submit Actions */}
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
                    Delete Post
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
