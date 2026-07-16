import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    if (auth.user) {
      setName(auth.user.name || '');
      setPhone(auth.user.phone || '');
      setDepartment(auth.user.department || '');
      setTwoFactorEnabled(auth.user.twoFactorEnabled || false);
    }
  }, [auth.user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (payload) => api.patch('/users/profile', payload),
    onSuccess: (response) => {
      toast.success('Settings updated successfully');
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    updateProfileMutation.mutate({
      name,
      phone,
      department,
      twoFactorEnabled,
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight font-display">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your profile information and configure Two-Factor security controls.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <h3 className="text-lg font-bold">Profile Details</h3>
          <p className="mt-1 text-xs text-slate-500">
            Your name, department context, and contact details used in fault reports and assignments.
          </p>
        </div>

        <div className="md:col-span-2 rounded-[2rem] border border-slate-200 bg-white/60 p-8 shadow-soft backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Full Name</label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100/50 px-4 py-3 text-sm outline-none text-slate-400 dark:border-slate-800 dark:bg-slate-950/20 cursor-not-allowed"
                  value={auth.user?.email || ''}
                  disabled
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Phone Number</label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Department</label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60"
                  placeholder="Facilities Management"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Security Preferences</h3>
              
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                <input
                  id="twoFactor"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-ink-600 focus:ring-ink-500 dark:border-slate-800 dark:bg-slate-950 dark:checked:bg-ink-500 cursor-pointer"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                />
                <div>
                  <label htmlFor="twoFactor" className="text-sm font-bold block cursor-pointer select-none">
                    Enable Two-Factor Authentication (2FA)
                  </label>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    When enabled, a secure 6-digit verification code will be sent to your email address during login. You must submit this code to verify your identity.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                disabled={updateProfileMutation.isPending}
                className="rounded-2xl bg-ink-900 hover:bg-ink-850 px-6 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
