import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-grid text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-6 py-4 shadow-premium backdrop-blur-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900/70">
          <span className="h-4 w-4 border-2 border-ink-500/30 border-t-ink-500 rounded-full animate-spin-smooth" />
          <span className="text-sm font-semibold text-[#475569] dark:text-[#cbd5e1]">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    const defaultPath = auth.user.role === 'admin'
      ? '/admin/dashboard'
      : auth.user.role === 'technician'
        ? '/technician/dashboard'
        : '/student/dashboard';
    return <Navigate to={defaultPath} replace />;
  }

  return children;
}
