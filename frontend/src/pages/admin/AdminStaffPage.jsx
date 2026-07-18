import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import BackButton from '../../components/BackButton';

const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

const getInitials = (name = 'U') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// Inline supervisor-category editor shown on each technician card.
function SupervisorEditor({ tech, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(tech.supervisorCategories || []);

  const toggle = (category) => {
    setSelected((current) => current.includes(category) ? current.filter((c) => c !== category) : [...current, category]);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setSelected(tech.supervisorCategories || []); setOpen(true); }}
        className="mt-2 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer"
      >
        {tech.supervisorCategories?.length ? 'Edit supervisor role' : 'Make supervisor'}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/30 space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Supervisor of departments:</p>
      <div className="grid grid-cols-1 gap-1 text-[11px]">
        {EXPERTISE_OPTIONS.map((category) => (
          <label key={category} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={selected.includes(category)} onChange={() => toggle(category)} className="h-3.5 w-3.5 rounded border-slate-300" />
            <span className="text-slate-700 dark:text-slate-300">{category}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button type="button" disabled={saving} onClick={() => { onSave(tech._id, selected); setOpen(false); }} className="flex-1 rounded-lg bg-ink-900 px-2 py-1.5 text-[10px] font-bold text-white dark:bg-white dark:text-ink-900 cursor-pointer">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold dark:border-slate-800 cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

// Three-dots (⋮) actions menu on each staff card: deactivate/reactivate and a
// two-step confirmed permanent delete. Admin accounts never get this menu.
function CardMenu({ user, onSetActive, onDelete, busy }) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (user.role === 'admin') return null;

  const close = () => {
    setOpen(false);
    setConfirmingDelete(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="grid h-8 w-8 place-items-center rounded-xl border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:text-slate-700 dark:hover:border-slate-700 dark:hover:text-slate-200 cursor-pointer"
        aria-label="User actions"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open ? (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 z-40 mt-1.5 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
            <button
              type="button"
              disabled={busy}
              onClick={() => { onSetActive(user._id, !(user.isActive ?? true)); close(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              {(user.isActive ?? true) ? '🚫 Deactivate account' : '✅ Reactivate account'}
            </button>
            {confirmingDelete ? (
              <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                <p className="text-[10px] font-bold text-rose-600">Pakka delete? Yeh wapas nahi hota.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { onDelete(user._id); close(); }}
                    className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-rose-700 cursor-pointer"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold dark:border-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/20 cursor-pointer"
              >
                🗑 Delete permanently
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AdminStaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'requests' | 'add'

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/users/technicians')).data.technicians
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.users
  });
  const { data: pending = [] } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => (await api.get('/users/pending')).data.pending,
    refetchInterval: 30000,
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting, isValid } } = useForm({
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '', role: 'technician', expertise: [], supervisorCategories: [] },
  });
  const selectedRole = watch('role');

  const invalidateStaff = () => {
    queryClient.invalidateQueries({ queryKey: ['technicians'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['pending-users'] });
  };

  const createMutation = useMutation({
    mutationFn: async (values) => (await api.post('/users', values)).data,
    onSuccess: (data) => {
      toast.success(`${data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1)} account created${data.emailSent ? ' — credentials emailed' : ''}`);
      invalidateStaff();
      setActiveTab('list');
      reset();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not create the account'),
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, action }) => (await api.patch(`/users/${id}/approval`, { action })).data,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateStaff();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not update the request'),
  });

  const supervisorMutation = useMutation({
    mutationFn: async ({ id, categories }) => (await api.patch(`/users/${id}/supervisor`, { categories })).data,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateStaff();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not update supervisor role'),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ id, isActive }) => (await api.patch(`/users/${id}/active`, { isActive })).data,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateStaff();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not update the account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/users/${id}`)).data,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateStaff();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not delete the account'),
  });

  const menuHandlers = {
    onSetActive: (id, isActive) => activeMutation.mutate({ id, isActive }),
    onDelete: (id) => deleteMutation.mutate(id),
    busy: activeMutation.isPending || deleteMutation.isPending,
  };

  const roleChip = (role) => role === 'admin'
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : role === 'technician'
      ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400'
      : 'bg-slate-500/10 text-slate-500 dark:text-slate-400';

  const tabButton = (key, label, badge = 0) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
        activeTab === key
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
          : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
      }`}
    >
      {label}
      {badge > 0 ? (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{badge}</span>
      ) : null}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Workspace Directory</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Manage Staff & Access Portal</h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-normal font-semibold">Onboard staff, approve signup requests, assign department supervisors, and manage expertise tags.</p>
      </section>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100/80 p-1 border border-slate-200/50 dark:bg-slate-950/40 dark:border-slate-800/80 max-w-xl gap-1">
        {tabButton('list', 'Staff Directory')}
        {tabButton('requests', 'Signup Requests', pending.length)}
        {tabButton('add', 'Onboard Staff')}
      </div>

      <div className="w-full">
        {activeTab === 'requests' ? (
          /* ── Pending signup approvals ── */
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 max-w-3xl animate-fade-in">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-1">Signup Requests</h2>
            <p className="text-xs text-slate-400 font-medium mb-5">Self-registered accounts wait here until you accept or reject them.</p>
            <div className="space-y-3">
              {pending.map((request) => (
                <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4 dark:border-amber-900/20 dark:bg-amber-950/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-bold flex items-center justify-center text-sm shrink-0">
                      {getInitials(request.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{request.name}</p>
                      <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold truncate">{request.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${roleChip(request.role)}`}>{request.role}</span>
                        {request.studentId ? <span className="text-[9px] font-bold text-slate-400 font-mono">{request.studentId}</span> : null}
                        {request.expertise?.map((tag) => (
                          <span key={tag} className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">{tag}</span>
                        ))}
                        <span className={`text-[9px] font-bold ${request.isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {request.isVerified ? '✓ Email verified' : '⏳ Email not verified yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: request._id, action: 'approve' })}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: request._id, action: 'reject' })}
                      className="rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 px-4 py-2 text-xs font-bold dark:border-rose-900/40 dark:hover:bg-rose-950/20 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pending.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">No pending signup requests. 🎉</p>
              ) : null}
            </div>
          </section>
        ) : activeTab === 'add' ? (
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 max-w-2xl animate-fade-in">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-1">Onboard Staff Account</h2>
              <p className="text-xs text-slate-400 font-medium mb-4">Admin-created accounts skip the approval queue — credentials are emailed directly.</p>
            <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Account Role</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-705 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 outline-none" {...register('role', { required: true })}>
                  <option value="technician">Technician (Solves complaints)</option>
                  <option value="admin">Administrator (Manages inventory & staff)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., Alice Smith" {...register('name', { required: 'Name is required' })} />
                {errors.name ? <p className="mt-1 text-xs text-rose-600 ml-1">{errors.name.message}</p> : null}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., alice@domain.com" {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email format' },
                })} />
                {errors.email ? <p className="mt-1 text-xs text-rose-600 ml-1">{errors.email.message}</p> : null}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Temporary Password</label>
                <input type="password" className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="••••••••" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} />
                {errors.password ? <p className="mt-1 text-xs text-rose-600 ml-1">{errors.password.message}</p> : null}
              </div>

              {selectedRole === 'technician' ? (
                <>
                  <div className="space-y-2 rounded-2xl border border-slate-150 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-950/20">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Expertise tag mapping (For AI Matching)</p>
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-650 dark:text-slate-350 sm:grid-cols-2">
                      {EXPERTISE_OPTIONS.map((category) => (
                        <label key={category} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input type="checkbox" value={category} {...register('expertise')} className="rounded border-slate-300 text-ink-600 focus:ring-ink-500 h-4 w-4" />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-indigo-200/60 p-4 dark:border-slate-800 bg-indigo-50/20 dark:bg-slate-950/20">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-650 dark:text-indigo-400">⭐ Supervisor of departments (optional)</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Supervisors review completed work in their departments: verify, close, or reopen resolved issues, and monitor team performance.</p>
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-650 dark:text-slate-350 sm:grid-cols-2">
                      {EXPERTISE_OPTIONS.map((category) => (
                        <label key={category} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input type="checkbox" value={category} {...register('supervisorCategories')} className="rounded border-slate-300 text-indigo-600 h-4 w-4" />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <button disabled={!isValid || isSubmitting || createMutation.isPending} className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 font-semibold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {createMutation.isPending ? 'Creating Account...' : !isValid ? 'Fill all required fields' : 'Register User Account'}
              </button>
            </form>
          </div>
        </section>
      ) : (
        /* ── Staff directory ── */
        <div className="space-y-6 max-w-5xl animate-fade-in">

          {/* Technicians as detail cards */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Onboarded Technicians</h2>
            <div className="grid gap-3 sm:grid-cols-2 max-h-[480px] overflow-y-auto pr-1">
              {technicians.map((tech) => (
                <div key={tech._id} className="rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-650 dark:bg-slate-950 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0">
                      {getInitials(tech.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{tech.name}</p>
                        {tech.supervisorCategories?.length ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full">⭐ Supervisor</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold truncate">{tech.email}</p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {tech.expertise?.length ? (
                          tech.expertise.map((tag) => (
                            <span key={tag} className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 dark:text-slate-400 text-slate-600 px-2 py-0.5 rounded-md border border-slate-150/40 dark:border-slate-800/60">{tag}</span>
                          ))
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 dark:text-slate-400 text-slate-600 px-2 py-0.5 rounded-md">General Maintenance</span>
                        )}
                      </div>

                      {tech.supervisorCategories?.length ? (
                        <p className="mt-1.5 text-[10px] font-semibold text-indigo-650 dark:text-indigo-400">Supervises: {tech.supervisorCategories.join(', ')}</p>
                      ) : null}

                      <SupervisorEditor
                        tech={tech}
                        saving={supervisorMutation.isPending}
                        onSave={(id, categories) => supervisorMutation.mutate({ id, categories })}
                      />
                    </div>
                    <CardMenu user={tech} {...menuHandlers} />
                  </div>
                </div>
              ))}
              {technicians.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6 col-span-full">No technician staff found.</p>
              ) : null}
            </div>
          </section>

          {/* All users as detail cards */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Workspace Registry — All Users</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 max-h-[420px] overflow-y-auto pr-1">
              {users.map((user) => (
                <div key={user._id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400 font-bold flex items-center justify-center text-xs shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-250 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">{user.email}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                        {[user.studentId, user.department, user.phone].filter(Boolean).join(' · ') || `Joined ${new Date(user.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user.isActive === false ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        Deactivated
                      </span>
                    ) : null}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${roleChip(user.role)}`}>
                      {user.role}
                    </span>
                    <CardMenu user={user} {...menuHandlers} />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      )}
      </div>
    </div>
  );
}
