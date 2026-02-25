// ============================================================
// TYPES
// ============================================================

export interface Author {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  tags: string[];
  followers: number;
  postCount: number;
  collaborators: number;
  isFollowing: boolean;
}

export interface Post {
  id: string;
  author: Author;
  sourceBoard?: { id: string; name: string };
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
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
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

// ============================================================
// MOCK DATA
// ============================================================

export const mockBoards: Board[] = [
  {
    id: '1',
    name: 'Минимализм в архитектуре',
    description: 'Чистые линии, пространство и свет. Лучшие примеры минималистской архитектуры со всего мира.',
    coverImage: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=300&fit=crop',
    tags: ['архитектура', 'минимализм', 'дизайн'],
    followers: 12400,
    postCount: 234,
    collaborators: 8,
    isFollowing: true,
  },
  {
    id: '2',
    name: 'Продуктивность и GTD',
    description: 'Системы, инструменты и привычки для максимальной эффективности.',
    coverImage: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=300&fit=crop',
    tags: ['продуктивность', 'GTD', 'привычки'],
    followers: 8900,
    postCount: 156,
    collaborators: 12,
    isFollowing: false,
  },
  {
    id: '3',
    name: 'Цифровое искусство',
    description: 'Иллюстрации, концепт-арт и генеративное искусство.',
    coverImage: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=300&fit=crop',
    tags: ['арт', 'иллюстрация', 'ИИ'],
    followers: 24100,
    postCount: 412,
    collaborators: 25,
    isFollowing: true,
  },
  {
    id: '4',
    name: 'Кофейная культура',
    description: 'Обжарка, заваривание, рецепты. Всё о specialty кофе.',
    coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    tags: ['кофе', 'рецепты', 'барista'],
    followers: 6700,
    postCount: 89,
    collaborators: 4,
    isFollowing: false,
  },
  {
    id: '5',
    name: 'UX Research',
    description: 'Методы исследований, кейсы и инсайты из практики UX.',
    coverImage: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop',
    tags: ['UX', 'исследования', 'дизайн'],
    followers: 15300,
    postCount: 198,
    collaborators: 17,
    isFollowing: false,
  },
  {
    id: '6',
    name: 'Растения дома',
    description: 'Уход, размножение и оформление интерьера с комнатными растениями.',
    coverImage: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
    tags: ['растения', 'интерьер', 'уход'],
    followers: 9200,
    postCount: 145,
    collaborators: 6,
    isFollowing: true,
  },
];

const mockAuthor: Author = {
  id: 'user1',
  name: 'Алекс Волков',
  username: '@alexvolkov',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
};

export const mockPosts: Post[] = [
  {
    id: 'p1',
    author: mockAuthor,
    sourceBoard: { id: '3', name: 'Цифровое искусство' },
    content: {
      type: 'image',
      title: 'Генеративные паттерны с помощью p5.js',
      caption: 'Экспериментировал с алгоритмами шума Перлина для создания органических форм. Каждый запуск даёт уникальный результат.',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
    },
    engagement: { reactions: 284, comments: 42, saves: 118 },
    timestamp: '2 часа назад',
  },
  {
    id: 'p2',
    author: {
      id: 'user2',
      name: 'Марина Соколова',
      username: '@marina.design',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    },
    sourceBoard: { id: '1', name: 'Минимализм в архитектуре' },
    content: {
      type: 'image',
      title: 'Tadao Ando — Church of the Light',
      caption: 'Игра света и тени как архитектурный элемент. Простой крест в стене создаёт сакральное пространство.',
      imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
    },
    engagement: { reactions: 521, comments: 67, saves: 203 },
    timestamp: '5 часов назад',
  },
  {
    id: 'p3',
    author: mockAuthor,
    content: {
      type: 'text',
      title: 'Почему я отказался от todo-приложений',
      text: 'Три года я искал идеальное приложение для задач. Перепробовал всё: Notion, Todoist, Things, OmniFocus. А потом взял бумажный блокнот.\n\nПарадокс: чем сложнее система, тем больше энергии уходит на её поддержку, а не на сами задачи. Бумага не присылает уведомлений. Она не требует синхронизации. Она просто есть.\n\nЕсли задача важная — я её запомню. Если не помню — может, не так уж и важна?',
    },
    engagement: { reactions: 892, comments: 134, saves: 445 },
    timestamp: '1 день назад',
  },
  {
    id: 'p4',
    author: {
      id: 'user3',
      name: 'Дмитрий Ким',
      username: '@dmitry.coffee',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    },
    sourceBoard: { id: '4', name: 'Кофейная культура' },
    content: {
      type: 'image',
      title: 'Эфиопия Иргачеффе: разбор вкусового профиля',
      caption: 'Черника, жасмин, цедра лимона. Этот лот от Nomad Roasters — один из лучших в этом году.',
      imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&h=600&fit=crop',
    },
    engagement: { reactions: 156, comments: 28, saves: 67 },
    timestamp: '2 дня назад',
  },
];

export const mockUserProfile: UserProfile = {
  id: 'user1',
  displayName: 'Алекс Волков',
  username: '@alexvolkov',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  bio: 'Дизайнер продуктов и любитель минимализма. Пишу о дизайне, технологиях и том, как делать меньше, но лучше.',
  stats: {
    followers: 4800,
    following: 312,
    boards: 6,
  },
  boards: mockBoards.slice(0, 4),
  posts: mockPosts.filter(p => p.author.id === 'user1'),
};
