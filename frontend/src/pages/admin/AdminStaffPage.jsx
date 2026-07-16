import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

export default function AdminStaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: technicians = [] } = useQuery({ 
    queryKey: ['technicians'], 
    queryFn: async () => (await api.get('/users/technicians')).data.technicians 
  });
  const { data: users = [] } = useQuery({ 
    queryKey: ['users'], 
    queryFn: async () => (await api.get('/users')).data.users 
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', email: '', password: '', role: 'technician', expertise: [] },
  });
  const selectedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: async (values) => (await api.post('/users', values)).data,
    onSuccess: (data) => {
      toast.success(`${data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1)} account created`);
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not create the account'),
  });

  const getInitials = (name = 'U') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition cursor-pointer">
          <span>←</span> <span>Back</span>
        </button>
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Workspace Directory</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Manage Staff & Access Portal</h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-normal font-semibold">Onboard administrative users and assign core technical expertise tags to staff members.</p>
      </section>

      {/* Split: Form & Listings */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Onboarding Form */}
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Onboard Staff Account</h2>
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
              ) : null}

              <button disabled={isSubmitting || createMutation.isPending} className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 font-semibold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer">
                {createMutation.isPending ? 'Creating Account...' : 'Register User Account'}
              </button>
            </form>
          </div>
        </section>

        {/* Listings Directory */}
        <div className="space-y-6">
          
          {/* Technicians List Cards */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Onboarded Technicians</h2>
            <div className="grid gap-3 max-h-[360px] overflow-y-auto pr-1">
              {technicians.map((tech) => (
                <div key={tech._id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                  <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-650 dark:bg-slate-950 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0">
                    {getInitials(tech.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{tech.name}</p>
                    <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold">{tech.email}</p>
                    
                    {/* Expertise badge-pills */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {tech.expertise?.length ? (
                        tech.expertise.map((tag) => (
                          <span key={tag} className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 dark:text-slate-400 text-slate-600 px-2 py-0.5 rounded-md border border-slate-150/40 dark:border-slate-800/60">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 dark:text-slate-400 text-slate-600 px-2 py-0.5 rounded-md border border-slate-150/40 dark:border-slate-800/60">
                          General Maintenance
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {technicians.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No technician staff found.</p>
              ) : null}
            </div>
          </section>

          {/* Directory Users list */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Workspace Registry</h2>
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {users.map((user) => (
                <div key={user._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400 font-bold flex items-center justify-center text-xs shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-250 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">{user.email}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    user.role === 'admin' 
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                      : user.role === 'technician' 
                        ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400' 
                        : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                  }`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
