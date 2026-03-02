import React from 'react';
import { X, Camera, MapPin, Link as LinkIcon, Check } from 'lucide-react';
import type { UserProfile } from '../data/mock-data';

interface EditProfileModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedProfile: Partial<UserProfile>) => void;
}

export function EditProfileModal({ isOpen, profile, onClose, onSave }: EditProfileModalProps) {
  const [displayName, setDisplayName] = React.useState(profile.displayName);
  const [username, setUsername] = React.useState(profile.username);
  const [bio, setBio] = React.useState(profile.bio);
  const [website, setWebsite] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [avatarPreview, setAvatarPreview] = React.useState(profile.avatar);
  const [isValidUsername, setIsValidUsername] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Validate username (3-20 chars, alphanumeric + underscore)
  const validateUsername = (value: string) => {
    const isValid = /^@?[a-zA-Z0-9_]{3,20}$/.test(value);
    setIsValidUsername(isValid);
    return isValid;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    validateUsername(value);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidUsername) {
      alert('Please enter a valid username');
      return;
    }

    if (!displayName.trim()) {
      alert('Please enter a display name');
      return;
    }

    onSave({
      displayName,
      username,
      bio,
      avatar: avatarPreview,
    });

    onClose();
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Edit Profile</h2>
              <p className="text-sm text-gray-600 mt-1">Update your profile information</p>
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
            <form onSubmit={handleSubmit} className="p-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center mb-8 p-6 bg-gradient-to-b from-blue-50 to-white rounded-xl border border-blue-100/50">
                <div className="relative mb-4">
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-28 h-28 rounded-full ring-4 ring-white shadow-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Click the camera icon to change your profile picture
                </p>
              </div>

              <div className="space-y-6">
                {/* Display Name */}
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name *
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your display name"
                    required
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    This is your public name shown on your profile
                  </p>
                </div>

                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                        isValidUsername
                          ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                          : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      }`}
                      placeholder="@username"
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
                    <p className="mt-1.5 text-xs text-red-600">
                      Username must be 3-20 characters (letters, numbers, underscore only)
                    </p>
                  )}
                  {isValidUsername && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      Your unique identifier on the platform
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    maxLength={200}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                    placeholder="Tell others about yourself..."
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-500">
                      A brief description of who you are and what you create
                    </p>
                    <p className="text-xs text-gray-500">
                      {bio.length} / 200
                    </p>
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Share your portfolio, blog, or personal website
                  </p>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="City, Country"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Where you're based or where you create from
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!displayName.trim() || !isValidUsername}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
