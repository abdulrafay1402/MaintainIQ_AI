import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRedirectPage() {
  const auth = useAuth();

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (auth.user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (auth.user.role === 'technician') {
    return <Navigate to="/technician/dashboard" replace />;
  }

  return <Navigate to="/student/dashboard" replace />;
}
