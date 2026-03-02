// Types
export type MoodType = 'inspired' | 'curious' | 'peaceful' | 'playful' | 'thoughtful' | 'energetic';

export interface MoodConfig {
  label: string;
  emoji: string;
  color: string;
  lightBg: string;
  borderColor: string;
  pastelBg: string;
  description: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  followers: number;
  postCount: number;
  collaborators: number;
  tags?: string[];
  isFollowing: boolean;
}

export interface Post {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  sourceBoard: {
    id: string;
    name: string;
  } | null;
  content: {
    type: 'image' | 'text' | 'mixed';
    title?: string;
    caption?: string;
    text?: string;
    imageUrl?: string;
  };
  engagement: {
    reactions: number;
    comments: number;
    saves: number;
  };
  timestamp: string;
  mood?: MoodType;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  stats: {
    followers: number;
    following: number;
    boards: number;
  };
  boards: Board[];
  posts: Post[];
}

// Mood Configurations
export const moodConfigs: Record<MoodType, MoodConfig> = {
  inspired: {
    label: 'Inspired',
    emoji: '✨',
    color: '#8B5CF6',
    lightBg: 'bg-purple-50',
    borderColor: 'border-purple-500',
    pastelBg: '#FAF5FF',
    description: 'Feeling creative and motivated'
  },
  curious: {
    label: 'Curious',
    emoji: '🔍',
    color: '#3B82F6',
    lightBg: 'bg-blue-50',
    borderColor: 'border-blue-500',
    pastelBg: '#EFF6FF',
    description: 'Exploring and discovering'
  },
  peaceful: {
    label: 'Peaceful',
    emoji: '🌿',
    color: '#10B981',
    lightBg: 'bg-green-50',
    borderColor: 'border-green-500',
    pastelBg: '#F0FDF4',
    description: 'Calm and centered'
  },
  playful: {
    label: 'Playful',
    emoji: '🎨',
    color: '#F59E0B',
    lightBg: 'bg-amber-50',
    borderColor: 'border-amber-500',
    pastelBg: '#FFFBEB',
    description: 'Fun and lighthearted'
  },
  thoughtful: {
    label: 'Thoughtful',
    emoji: '💭',
    color: '#6366F1',
    lightBg: 'bg-indigo-50',
    borderColor: 'border-indigo-500',
    pastelBg: '#EEF2FF',
    description: 'Deep in contemplation'
  },
  energetic: {
    label: 'Energetic',
    emoji: '⚡',
    color: '#EF4444',
    lightBg: 'bg-red-50',
    borderColor: 'border-red-500',
    pastelBg: '#FEF2F2',
    description: 'Full of energy and excitement'
  }
};

// Mock Boards Data
export const mockBoards: Board[] = [
  {
    id: 'b1',
    name: 'Minimalist Aesthetics',
    description: 'Clean lines, simple forms, and intentional spaces. Exploring the beauty of less is more.',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    followers: 12400,
    postCount: 3456,
    collaborators: 8,
    tags: ['minimalism', 'design', 'architecture'],
    isFollowing: true
  },
  {
    id: 'b2',
    name: 'Natural Landscapes',
    description: 'Breathtaking views from around the world. Mountains, oceans, forests, and beyond.',
    coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    followers: 28900,
    postCount: 8934,
    collaborators: 15,
    tags: ['nature', 'photography', 'travel'],
    isFollowing: false
  },
  {
    id: 'b3',
    name: 'Botanical Studies',
    description: 'The intricate patterns and structures of plant life. From macro photography to botanical illustrations.',
    coverImage: 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=800&q=80',
    followers: 15600,
    postCount: 4521,
    collaborators: 12,
    tags: ['botany', 'plants', 'science'],
    isFollowing: true
  },
  {
    id: 'b4',
    name: 'Editorial Design',
    description: 'Magazine spreads, layouts, and typography that tell stories through design.',
    coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    followers: 19200,
    postCount: 5678,
    collaborators: 20,
    tags: ['editorial', 'typography', 'publishing'],
    isFollowing: false
  },
  {
    id: 'b5',
    name: 'Urban Exploration',
    description: 'Discovering hidden corners and architectural gems in cities around the globe.',
    coverImage: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
    followers: 22100,
    postCount: 6789,
    collaborators: 18,
    tags: ['urban', 'architecture', 'photography'],
    isFollowing: true
  },
  {
    id: 'b6',
    name: 'Ceramic Arts',
    description: 'Handcrafted pottery, sculptures, and functional art pieces celebrating clay and form.',
    coverImage: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80',
    followers: 11800,
    postCount: 2345,
    collaborators: 9,
    tags: ['ceramics', 'pottery', 'craft'],
    isFollowing: false
  },
  {
    id: 'b7',
    name: 'Analog Photography',
    description: 'Film photography in all its grainy, imperfect, beautiful glory.',
    coverImage: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80',
    followers: 17300,
    postCount: 5432,
    collaborators: 14,
    tags: ['film', 'analog', 'photography'],
    isFollowing: true
  },
  {
    id: 'b8',
    name: 'Japanese Aesthetics',
    description: 'Wabi-sabi, zen, and the art of finding beauty in imperfection and transience.',
    coverImage: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
    followers: 25700,
    postCount: 7123,
    collaborators: 16,
    tags: ['japanese', 'zen', 'philosophy'],
    isFollowing: false
  }
];

// Mock Posts Data
export const mockPosts: Post[] = [
  {
    id: 'p1',
    author: {
      name: 'Elena Rodriguez',
      username: '@elenarod',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80'
    },
    sourceBoard: {
      id: 'b1',
      name: 'Minimalist Aesthetics'
    },
    content: {
      type: 'image',
      title: 'The Space Between',
      caption: 'Sometimes the most powerful design element is the one you don\'t add. This minimalist workspace embodies the principle that simplicity is the ultimate sophistication.',
      imageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&q=80'
    },
    engagement: {
      reactions: 342,
      comments: 28,
      saves: 156
    },
    timestamp: '2 hours ago',
    mood: 'peaceful'
  },
  {
    id: 'p2',
    author: {
      name: 'Marcus Chen',
      username: '@marcusc',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80'
    },
    sourceBoard: {
      id: 'b2',
      name: 'Natural Landscapes'
    },
    content: {
      type: 'image',
      title: 'Mountain Morning',
      caption: 'Caught this moment just as the sun broke through the clouds. The way light transforms a landscape never ceases to amaze me.',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80'
    },
    engagement: {
      reactions: 521,
      comments: 43,
      saves: 234
    },
    timestamp: '5 hours ago',
    mood: 'inspired'
  },
  {
    id: 'p3',
    author: {
      name: 'Sophia Anderson',
      username: '@sophiaa',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80'
    },
    sourceBoard: null,
    content: {
      type: 'text',
      title: 'On Finding Your Creative Process',
      text: 'I used to think that having a creative process meant following a strict routine. Wake up at 5am, journal for 20 minutes, meditate, etc.\n\nBut I\'ve learned that creativity isn\'t about rigidity—it\'s about creating the conditions where inspiration can find you. Sometimes that\'s a structured morning. Sometimes it\'s a 2am burst of energy.\n\nThe key is staying curious and being present when those moments arrive.'
    },
    engagement: {
      reactions: 287,
      comments: 54,
      saves: 198
    },
    timestamp: '8 hours ago',
    mood: 'thoughtful'
  },
  {
    id: 'p4',
    author: {
      name: 'Yuki Tanaka',
      username: '@yukitanaka',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80'
    },
    sourceBoard: {
      id: 'b3',
      name: 'Botanical Studies'
    },
    content: {
      type: 'image',
      title: 'Fern Fractal',
      caption: 'The mathematical precision in nature never stops fascinating me. This unfurling fern frond demonstrates the Fibonacci sequence perfectly—a reminder that beauty and mathematics are deeply intertwined.',
      imageUrl: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=1200&q=80'
    },
    engagement: {
      reactions: 412,
      comments: 36,
      saves: 289
    },
    timestamp: '12 hours ago',
    mood: 'curious'
  },
  {
    id: 'p5',
    author: {
      name: 'James Mitchell',
      username: '@jmitchell',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80'
    },
    sourceBoard: {
      id: 'b4',
      name: 'Editorial Design'
    },
    content: {
      type: 'image',
      title: 'Typography in Motion',
      caption: 'Experimenting with kinetic typography for a magazine spread. The challenge was making the text feel alive while maintaining readability.',
      imageUrl: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1200&q=80'
    },
    engagement: {
      reactions: 198,
      comments: 21,
      saves: 134
    },
    timestamp: '1 day ago',
    mood: 'playful'
  },
  {
    id: 'p6',
    author: {
      name: 'Isabella Costa',
      username: '@isabellac',
      avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&q=80'
    },
    sourceBoard: {
      id: 'b5',
      name: 'Urban Exploration'
    },
    content: {
      type: 'image',
      title: 'City Geometry',
      caption: 'Found this incredible play of light and shadow in downtown. Architecture becomes abstract art when you look at it from the right angle.',
      imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80'
    },
    engagement: {
      reactions: 456,
      comments: 38,
      saves: 267
    },
    timestamp: '1 day ago',
    mood: 'energetic'
  },
  {
    id: 'p7',
    author: {
      name: 'Elena Rodriguez',
      username: '@elenarod',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80'
    },
    sourceBoard: {
      id: 'b7',
      name: 'Analog Photography'
    },
    content: {
      type: 'image',
      title: 'Portra 400 Magic',
      caption: 'There\'s something about film grain that digital can never quite replicate. Shot on Portra 400 with my grandfather\'s old Canon AE-1.',
      imageUrl: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&q=80'
    },
    engagement: {
      reactions: 389,
      comments: 45,
      saves: 234
    },
    timestamp: '2 days ago',
    mood: 'peaceful'
  }
];

// Mock User Profile Data
export const mockUserProfile: UserProfile = {
  id: 'u1',
  username: '@elenarod',
  displayName: 'Elena Rodriguez',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
  bio: 'Designer & visual storyteller. Finding beauty in simplicity and meaning in details. Based in Barcelona, working worldwide. 🎨✨',
  stats: {
    followers: 15600,
    following: 342,
    boards: 12
  },
  boards: [
    mockBoards[0],
    mockBoards[2],
    mockBoards[4],
    mockBoards[6]
  ],
  posts: [
    mockPosts[0],
    mockPosts[6]
  ]
};