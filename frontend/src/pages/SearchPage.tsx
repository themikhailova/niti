import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { api } from '@/api/client';
import type { SearchUser } from '@/types';
import { getAvatarUrl } from '@/utils/helpers';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [popular, setPopular] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await api.search(q);
      setResults(data.users);
      setPopular(data.popular_users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch(query);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    doSearch(query);
  };

  const displayUsers = query ? results : popular;
  const sectionTitle = query
    ? results.length > 0 ? `Результаты для "${query}"` : `Ничего не найдено по запросу "${query}"`
    : 'Популярные авторы';

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени..."
          className="w-full pl-9 pr-4 py-2.5 bg-input-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </form>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{sectionTitle}</h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-muted rounded w-32" />
                    <div className="h-3 bg-muted rounded w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayUsers.length > 0 ? (
          <div className="space-y-2">
            {displayUsers.map(user => (
              <Link
                key={user.id}
                to={`/profile/${user.username}`}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-ring/30 transition-colors"
              >
                <img
                  src={getAvatarUrl(user.username, user.avatar)}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{user.username}</p>
                  {user.interests && user.interests.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {user.interests.slice(0, 4).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-foreground">{user.followers_count}</p>
                  <p className="text-xs text-muted-foreground">подписчиков</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          !loading && query && (
            <p className="text-center text-muted-foreground py-8">
              Попробуйте другой запрос
            </p>
          )
        )}
      </div>
    </main>
  );
}
