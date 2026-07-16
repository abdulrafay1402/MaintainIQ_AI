import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const menuByRole = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/student/scan', label: 'Scan QR', icon: '🔍' },
    { to: '/student/complaints', label: 'My Complaints', icon: '📋' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/admin/equipment', label: 'Equipment', icon: '🛡️' },
    { to: '/admin/complaints', label: 'Complaints', icon: '📋' },
    { to: '/admin/staff', label: 'Staff Directory', icon: '👥' },
  ],
  technician: [
    { to: '/technician/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/technician/tasks', label: 'My Tasks', icon: '🛠️' },
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

  const getInitials = (name = 'U') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-hero-grid text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row p-4 gap-6">
        
        {/* Sidebar Container */}
        <aside className="glass-panel flex flex-col justify-between rounded-[2rem] p-6 lg:w-76 shrink-0 z-10">
          <div>
            {/* Header Brand */}
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">MaintainIQ</p>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {auth.user?.role === 'student' ? 'Student Hub' : auth.user?.role === 'technician' ? 'Technical Hub' : 'Admin Hub'}
                </h1>
              </div>
              
              {/* Quick Actions (Notifications + Theme Switcher) */}
              <div className="flex gap-2 items-center">
                {/* Theme Toggle */}
                <button 
                  onClick={theme.toggleTheme} 
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Toggle Theme"
                >
                  {theme.isDark ? '☀️' : '🌙'}
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)} 
                    className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer" 
                    aria-label="Notifications"
                  >
                    🔔
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {showNotifications ? (
                    <div className="absolute right-0 z-35 mt-3 w-80 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:left-0 lg:right-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</p>
                        {unreadCount > 0 ? (
                          <button 
                            onClick={() => markAllReadMutation.mutate()} 
                            className="text-xs font-semibold text-ink-600 hover:text-ink-700 underline underline-offset-2 dark:text-ink-300"
                          >
                            Mark all read
                          </button>
                        ) : null}
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {notifications.length > 0 ? notifications.slice(0, 10).map((item) => (
                          <div 
                            key={item._id} 
                            className={`rounded-xl border p-3 text-xs transition ${
                              item.isRead 
                                ? 'border-slate-100 text-slate-400 dark:border-slate-800/60' 
                                : 'border-ink-200/60 bg-ink-50/20 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-350'
                            }`}
                          >
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                            <p className="mt-1 leading-normal">{item.message}</p>
                            <p className="mt-1 text-[9px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                          </div>
                        )) : (
                          <p className="py-6 text-center text-xs text-slate-400">No new notifications</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="mt-8 grid gap-2">
              {menu.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  className={({ isActive }) => 
                    `flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                      isActive 
                        ? 'bg-gradient-to-r from-ink-800 to-indigo-900 text-white shadow-soft dark:from-white dark:to-white dark:text-slate-950' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* User Profile Info Card */}
          <div className="mt-8 rounded-[1.5rem] bg-slate-50/70 p-4 border border-slate-100/60 dark:bg-slate-950/30 dark:border-slate-800/40 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-ink-100 text-ink-700 dark:bg-ink-950 dark:text-ink-300 font-bold flex items-center justify-center text-sm shrink-0">
                {getInitials(auth.user?.name)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{auth.user?.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{auth.user?.email}</p>
              </div>
            </div>
            <button 
              onClick={auth.logout} 
              className="w-full text-center rounded-xl bg-ink-900 hover:bg-ink-850 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
            >
              Log out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">
          {isAdmin && (unassignedCount > 0 || criticalCount > 0) ? (
            <div className="relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-rose-200/80 bg-rose-50/60 p-6 shadow-soft backdrop-blur-sm dark:border-rose-950/20 dark:bg-rose-950/20 animate-pulse-subtle">
              {/* Alert gradient side line */}
              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-rose-500 to-red-600" />
              
              <div className="flex items-center gap-4 pl-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 text-lg">
                  🚨
                </span>
                <div>
                  <p className="font-bold text-rose-950 dark:text-rose-200 tracking-tight">Active System Alerts</p>
                  <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed font-semibold">
                    {unassignedCount > 0 ? `${unassignedCount} complaints need assignment. ` : ''}
                    {criticalCount > 0 ? `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require attention!` : ''}
                  </p>
                </div>
              </div>
              
              <NavLink
                to="/admin/complaints"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2.5 text-xs font-bold text-white transition-all text-center self-start md:self-auto cursor-pointer"
              >
                Resolve Alerts
              </NavLink>
            </div>
          ) : null}
          
          <div className="min-h-[calc(100vh-6rem)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
