import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Loader from './components/Loader';

// Route-level code splitting keeps the initial bundle small (faster reloads);
// each page chunk loads on demand.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const RoleRedirectPage = lazy(() => import('./pages/RoleRedirectPage'));
const PublicAssetPage = lazy(() => import('./pages/public/PublicAssetPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminEquipmentPage = lazy(() => import('./pages/admin/AdminEquipmentPage'));
const AdminComplaintsPage = lazy(() => import('./pages/admin/AdminComplaintsPage'));
const AdminStaffPage = lazy(() => import('./pages/admin/AdminStaffPage'));
const AssetLabelPage = lazy(() => import('./pages/admin/AssetLabelPage').then((m) => ({ default: m.AssetLabelPage })));
const AssetLabelSheetPage = lazy(() => import('./pages/admin/AssetLabelPage').then((m) => ({ default: m.AssetLabelSheetPage })));
const TechnicianDashboardPage = lazy(() => import('./pages/technician/TechnicianDashboardPage'));
const TechnicianTasksPage = lazy(() => import('./pages/technician/TechnicianTasksPage'));
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const StudentComplaintsPage = lazy(() => import('./pages/student/StudentComplaintsPage'));
const StudentScanPage = lazy(() => import('./pages/student/StudentScanPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EquipmentBrowsePage = lazy(() => import('./pages/EquipmentBrowsePage'));
const TechnicianTeamPage = lazy(() => import('./pages/technician/TechnicianTeamPage'));

const PageFallback = () => <Loader label="Loading" />;

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/public/assets/:code" element={<PublicAssetPage />} />

        {/* Post-login role redirect */}
        <Route path="/dashboard" element={<RoleRedirectPage />} />

        {/* Print-ready QR label pages (admin only, outside the dashboard shell for clean printing) */}
        <Route path="/admin/equipment/labels" element={<ProtectedRoute allowedRoles={['admin']}><AssetLabelSheetPage /></ProtectedRoute>} />
        <Route path="/admin/equipment/:id/label" element={<ProtectedRoute allowedRoles={['admin']}><AssetLabelPage /></ProtectedRoute>} />

        {/* Protected routes wrapped in DashboardLayout */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Admin portal */}
          <Route path="admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="admin/equipment" element={<ProtectedRoute allowedRoles={['admin']}><AdminEquipmentPage /></ProtectedRoute>} />
          <Route path="admin/complaints" element={<ProtectedRoute allowedRoles={['admin']}><AdminComplaintsPage /></ProtectedRoute>} />
          <Route path="admin/staff" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaffPage /></ProtectedRoute>} />

          {/* Technician portal */}
          <Route path="technician/dashboard" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianDashboardPage /></ProtectedRoute>} />
          <Route path="technician/tasks" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianTasksPage /></ProtectedRoute>} />
          <Route path="technician/team" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianTeamPage /></ProtectedRoute>} />

          {/* Equipment browser — visible to every logged-in role */}
          <Route path="equipment" element={<ProtectedRoute><EquipmentBrowsePage /></ProtectedRoute>} />

          {/* Student/Reporter portal */}
          <Route path="student/dashboard" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentDashboardPage /></ProtectedRoute>} />
          <Route path="student/complaints" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentComplaintsPage /></ProtectedRoute>} />
          <Route path="student/scan" element={<ProtectedRoute allowedRoles={['student', 'admin', 'technician']}><StudentScanPage /></ProtectedRoute>} />

          {/* Global Settings */}
          <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Route>

        {/* Catch-all for non-existing pages */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
