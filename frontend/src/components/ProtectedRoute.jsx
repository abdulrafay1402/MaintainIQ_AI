import { Navigate } from 'react-router-dom';
import Loader from './Loader';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();

  if (auth.loading) {
    return <Loader label="Verifying session" />;
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
