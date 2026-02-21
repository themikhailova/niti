import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import FeedPage from '@/pages/FeedPage';
import ProfilePage from '@/pages/ProfilePage';
import SearchPage from '@/pages/SearchPage';
import SettingsPage from '@/pages/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <Navigate to="/feed" replace /> : <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Private */}
          <Route path="/feed" element={
            <PrivateRoute>
              <AppLayout><FeedPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/profile/:username" element={
            <PrivateRoute>
              <AppLayout><ProfilePage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/search" element={
            <PrivateRoute>
              <AppLayout><SearchPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <AppLayout><SettingsPage /></AppLayout>
            </PrivateRoute>
          } />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
