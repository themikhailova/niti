import { Link, useNavigate, useLocation } from 'react-router';
import { Home, Search, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getAvatarUrl } from '@/utils/helpers';
import { api } from '@/api/client';

export function Navbar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    navigate('/login');
  };

  if (!user) return null;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive(to)
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="text-xl font-bold tracking-tight text-foreground">
          нити
        </Link>

        <nav className="flex items-center gap-1">
          {navItem('/feed', <Home className="w-4 h-4" />, 'Лента')}
          {navItem('/search', <Search className="w-4 h-4" />, 'Поиск')}
          {navItem(`/profile/${user.username}`, <User className="w-4 h-4" />, 'Профиль')}
        </nav>

        <div className="flex items-center gap-2">
          <Link to={`/profile/${user.username}`}>
            <img
              src={getAvatarUrl(user.username, user.avatar)}
              alt={user.username}
              className="w-8 h-8 rounded-full object-cover border border-border"
            />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/50 transition"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
