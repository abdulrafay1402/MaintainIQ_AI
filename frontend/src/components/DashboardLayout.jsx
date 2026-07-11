import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const menuByRole = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard' },
    { to: '/student/scan', label: 'Scan QR' },
    { to: '/student/complaints', label: 'My Complaints' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/equipment', label: 'Equipment' },
    { to: '/admin/complaints', label: 'Complaints' },
    { to: '/admin/staff', label: 'Staff' },
  ],
  technician: [
    { to: '/technician/dashboard', label: 'Dashboard' },
    { to: '/technician/tasks', label: 'Tasks' },
  ],
};

export default function DashboardLayout() {
  const auth = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const menu = menuByRole[auth.user?.role] || [];
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: notificationData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
    refetchInterval: 20000,
  });
  const notifications = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const isAdmin = auth.user?.role === 'admin';
  const { data: issues = [] } = useQuery({
    queryKey: ['admin-notifications-issues'],
    queryFn: async () => (await api.get('/issues')).data.issues,
    enabled: isAdmin,
    refetchInterval: 15000,
  });

  const unassignedCount = issues.filter((i) => !i.assignedTechnician && i.status === 'Reported').length;
  const criticalCount = issues.filter((i) => i.priority === 'Critical' && i.status !== 'Resolved' && i.status !== 'Closed').length;

  return <div className="min-h-screen bg-hero-grid text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
      <aside className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-start justify-between gap-4 lg:flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500">MaintainIQ</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{auth.user?.role === 'student' ? 'Student Portal' : auth.user?.role === 'technician' ? 'Technical Portal' : 'Admin Portal'}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{auth.user?.name}</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-lg dark:border-slate-800" aria-label="Notifications">
              🔔
              {unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
            </button>
            {showNotifications ? (
              <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:left-0 lg:right-auto">
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 ? <button onClick={() => markAllReadMutation.mutate()} className="text-xs font-medium text-ink-600 underline underline-offset-2 dark:text-ink-300">Mark all read</button> : null}
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {notifications.length > 0 ? notifications.slice(0, 15).map((item) => (
                    <div key={item._id} className={`rounded-xl border p-3 text-xs ${item.isRead ? 'border-slate-100 text-slate-500 dark:border-slate-800' : 'border-ink-200 bg-ink-50/50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'}`}>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-0.5">{item.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  )) : <p className="px-1 py-4 text-center text-xs text-slate-500">No notifications yet.</p>}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-8 grid gap-2">
          {menu.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
            {item.label}
          </NavLink>)}
        </nav>

        <div className="mt-8 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-white">Signed in as</p>
          <p className="mt-1 break-all">{auth.user?.email}</p>
          <button onClick={auth.logout} className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-white dark:bg-white dark:text-ink-900">Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 space-y-6">
        {isAdmin && (unassignedCount > 0 || criticalCount > 0) ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-rose-200 bg-rose-50/60 p-5 dark:border-rose-950/20 dark:bg-rose-950/20 animate-pulse-subtle">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 text-lg">
                🔔
              </span>
              <div>
                <p className="font-semibold text-rose-950 dark:text-rose-200">System Notification</p>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  {unassignedCount > 0 ? `${unassignedCount} complaints need assignment. ` : ''}
                  {criticalCount > 0 ? `${criticalCount} critical issues are currently active!` : ''}
                </p>
              </div>
            </div>
            <NavLink
              to="/admin/complaints"
              className="rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-700 text-center"
            >
              Resolve Complaints
            </NavLink>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  </div>;
}
