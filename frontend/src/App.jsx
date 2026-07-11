import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import RoleRedirectPage from './pages/RoleRedirectPage';
import PublicAssetPage from './pages/public/PublicAssetPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminEquipmentPage from './pages/admin/AdminEquipmentPage';
import AdminComplaintsPage from './pages/admin/AdminComplaintsPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import TechnicianDashboardPage from './pages/technician/TechnicianDashboardPage';
import TechnicianTasksPage from './pages/technician/TechnicianTasksPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import StudentComplaintsPage from './pages/student/StudentComplaintsPage';
import StudentScanPage from './pages/student/StudentScanPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/public/assets/:code" element={<PublicAssetPage />} />

      {/* Protected routes wrapped in DashboardLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirectPage />} />

        {/* Admin portal */}
        <Route path="admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="admin/equipment" element={<ProtectedRoute allowedRoles={['admin']}><AdminEquipmentPage /></ProtectedRoute>} />
        <Route path="admin/complaints" element={<ProtectedRoute allowedRoles={['admin']}><AdminComplaintsPage /></ProtectedRoute>} />
        <Route path="admin/staff" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaffPage /></ProtectedRoute>} />

        {/* Technician portal */}
        <Route path="technician/dashboard" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianDashboardPage /></ProtectedRoute>} />
        <Route path="technician/tasks" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianTasksPage /></ProtectedRoute>} />

        {/* Student/Reporter portal */}
        <Route path="student/dashboard" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentDashboardPage /></ProtectedRoute>} />
        <Route path="student/complaints" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentComplaintsPage /></ProtectedRoute>} />
        <Route path="student/scan" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentScanPage /></ProtectedRoute>} />
      </Route>

      {/* Catch-all for non-existing pages */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
