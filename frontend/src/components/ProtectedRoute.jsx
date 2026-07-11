import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-grid">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-soft dark:bg-slate-900">
          Loading session...
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
