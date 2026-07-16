import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ 
    defaultValues: { email: '', password: '' } 
  });

  const loginMutation = useMutation({
    mutationFn: async (values) => api.post('/auth/login', values),
    onSuccess: (response) => {
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
      toast.success('Welcome back');
      const role = response.data.user.role;
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'technician' ? '/technician/dashboard' : '/student/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Login failed');
    },
  });

  const onSubmit = (values) => loginMutation.mutateAsync(values);

  return (
    <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      {/* Visual Ambient Orbs */}
      <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
      <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

      <div className="relative mx-auto grid max-w-5xl w-full items-stretch overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/60 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-2 z-10">
        
        {/* Left Side: Premium Brand Context */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-ink-900 to-indigo-950 p-12 text-white lg:flex relative overflow-hidden">
          {/* Subtle overlay grid lines */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,77,255,0.18),transparent_55%)]" />
          <div className="absolute top-1/2 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-500/10 blur-[80px]" />
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-accent-300">MaintainIQ Workspace</span>
            </div>
            
            <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-white font-display">
              Maintenance requests with <span className="bg-gradient-to-r from-accent-300 to-indigo-300 bg-clip-text text-transparent">QR-first</span> workflows.
            </h1>
            
            <p className="mt-6 text-slate-350 text-sm leading-relaxed font-medium">
              Scan equipment QR codes to report faults instantly, preview automated AI triage diagnoses, verify details, and track status history securely.
            </p>
          </div>
          
          <div className="mt-12 text-[11px] text-slate-400 font-semibold tracking-wide">
            © 2026 MaintainIQ. All rights reserved.
          </div>
        </div>

        {/* Right Side: Interactive Action Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white/40 dark:bg-slate-900/20">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Access Portal</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Welcome back</h2>
          <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">Use your registered account to sign in.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Email Address</label>
              <input 
                type="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="name@example.com" 
                {...register('email', { 
                  required: 'Email is required',
                  pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' }
                })} 
              />
              {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.email.message}</p> : null}
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Password</label>
              </div>
              <input 
                type="password" 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="••••••••" 
                {...register('password', { required: 'Password is required' })} 
              />
              {errors.password ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.password.message}</p> : null}
            </div>
            
            <button 
              disabled={isSubmitting || loginMutation.isPending} 
              className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {isSubmitting || loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs font-semibold text-slate-400 dark:text-slate-500">
            Don't have an account? <Link className="font-bold text-ink-600 hover:text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300" to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
