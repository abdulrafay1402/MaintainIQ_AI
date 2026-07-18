import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Clean SVG Icons to replace all emojis
const Icons = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
    </svg>
  ),
  Scan: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Complaints: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  Equipment: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Staff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Tasks: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h6" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Sun: () => (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  ),
  Moon: () => (
    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Alert: () => (
    <svg className="w-5 h-5 text-rose-600 dark:text-rose-450" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Ellipsis: () => (
    <svg className="w-6 h-6 text-slate-700 dark:text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
  Close: () => (
    <svg className="w-6 h-6 text-slate-700 dark:text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
};

const menuByRole = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { to: '/student/scan', label: 'Scan QR', icon: Icons.Scan },
    { to: '/equipment', label: 'Equipment', icon: Icons.Equipment },
    { to: '/student/complaints', label: 'My Complaints', icon: Icons.Complaints },
    { to: '/settings', label: 'Settings', icon: Icons.Settings },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { to: '/admin/equipment', label: 'Equipment', icon: Icons.Equipment },
    { to: '/admin/complaints', label: 'Complaints', icon: Icons.Complaints },
    { to: '/admin/staff', label: 'Staff Directory', icon: Icons.Staff },
    { to: '/settings', label: 'Settings', icon: Icons.Settings },
  ],
  technician: [
    { to: '/technician/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { to: '/technician/tasks', label: 'My Tasks', icon: Icons.Tasks },
    { to: '/technician/team', label: 'Team', icon: Icons.Staff },
    { to: '/equipment', label: 'Equipment', icon: Icons.Equipment },
    { to: '/settings', label: 'Settings', icon: Icons.Settings },
  ],
};

export default function DashboardLayout() {
  const auth = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const menu = menuByRole[auth.user?.role] || [];
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleLogout = async () => {
    await auth.logout();
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderNotificationsPanel = (positionClass) => (
    <div className={`absolute z-35 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 ${positionClass}`}>
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
  );

  const renderAsideContent = () => (
    <>
      <div className="flex flex-col">
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
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Toggle Theme"
            >
              {theme.isDark ? <Icons.Sun /> : <Icons.Moon />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition cursor-pointer" 
                aria-label="Notifications"
              >
                <Icons.Bell />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>

              {showNotifications ? renderNotificationsPanel('right-0 lg:left-0 lg:right-auto') : null}
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="mt-8 grid gap-2">
          {menu.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to} 
              onClick={closeMobileMenu}
              className={({ isActive }) => 
                `flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  isActive 
                    ? 'bg-gradient-to-r from-ink-800 to-indigo-900 text-white shadow-soft dark:from-white dark:to-white dark:text-slate-950' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                }`
              }
            >
              <span className="text-base shrink-0"><item.icon /></span>
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
          onClick={handleLogout} 
          className="w-full text-center rounded-xl bg-ink-900 hover:bg-ink-850 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
        >
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-hero-grid text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      
      {/* Mobile Top Header (Sticky) */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between p-4 bg-white/70 backdrop-blur-md border-b border-slate-200/50 dark:bg-slate-950/70 dark:border-slate-800/50 shadow-sm">
        <div className="flex items-center gap-2.5">
          {!['/student/dashboard', '/admin/dashboard', '/technician/dashboard'].includes(location.pathname) && (
            <button 
              onClick={() => navigate(-1)} 
              className="mr-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/65 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900 cursor-pointer"
              aria-label="Go Back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-500">MaintainIQ</span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-white">
              {auth.user?.role === 'student' ? 'Student Portal' : auth.user?.role === 'technician' ? 'Technical Portal' : 'Admin Workspace'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Theme Toggle (Mobile) */}
          <button
            onClick={theme.toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-xs hover:bg-slate-100"
          >
            {theme.isDark ? <Icons.Sun /> : <Icons.Moon />}
          </button>

          {/* Notifications Bell (Mobile) */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
              aria-label="Notifications"
            >
              <Icons.Bell />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            {showNotifications ? renderNotificationsPanel('right-0') : null}
          </div>

          {/* User Profile Avatar (Mobile) */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="h-9 w-9 rounded-full bg-ink-100 text-ink-700 dark:bg-ink-950 dark:text-ink-300 font-bold flex items-center justify-center text-xs cursor-pointer border border-slate-200/80 dark:border-slate-800"
          >
            {getInitials(auth.user?.name)}
          </button>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div 
          onClick={closeMobileMenu}
          className="lg:hidden fixed inset-0 z-45 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] lg:min-h-screen max-w-[1600px] flex-col lg:flex-row p-4 pb-24 lg:pb-4 gap-6">
        
        {/* Desktop Sidebar (Persistent left side) */}
        <aside className="hidden lg:flex flex-col justify-between glass-panel rounded-[2rem] p-6 w-76 shrink-0 z-10 sticky top-4 h-[calc(100vh-2rem)]">
          {renderAsideContent()}
        </aside>

        {/* Mobile Profile Drawer (Sliding Overlay from Right) */}
        <aside 
          className={`lg:hidden fixed inset-y-0 right-0 z-50 flex flex-col justify-between w-72 bg-white/95 dark:bg-slate-950/95 p-6 shadow-2xl transition-transform duration-300 transform border-l border-slate-200/60 dark:border-slate-800 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display">Account Profile</h2>
              <button onClick={closeMobileMenu} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900">
                <Icons.Close />
              </button>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <div className="h-14 w-14 rounded-full bg-ink-100 text-ink-700 dark:bg-ink-950 dark:text-ink-300 font-bold flex items-center justify-center text-lg">
                {getInitials(auth.user?.name)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-base truncate">{auth.user?.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{auth.user?.email}</p>
                <span className="inline-block mt-2 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-650 dark:bg-ink-950/60 dark:text-ink-300">
                  {auth.user?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <NavLink
              to="/settings"
              onClick={closeMobileMenu}
              className="w-full text-center rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-900"
            >
              Account Settings
            </NavLink>
            <button 
              onClick={handleLogout} 
              className="w-full text-center rounded-xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
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
                <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-450 text-lg shrink-0">
                  <Icons.Alert />
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
                onClick={closeMobileMenu}
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

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-950/90 border-t border-slate-200/50 dark:border-slate-800/50 px-2 py-2 flex items-center justify-around shadow-lg backdrop-blur-md">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-xl transition text-center ${
                isActive
                  ? 'text-ink-600 dark:text-ink-300 font-extrabold scale-105'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-450 font-semibold'
              }`
            }
          >
            <span className="text-lg shrink-0"><item.icon /></span>
            <span className="text-[9px] uppercase tracking-wider font-bold block">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
