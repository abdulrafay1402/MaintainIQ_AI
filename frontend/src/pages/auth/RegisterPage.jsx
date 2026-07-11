import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', email: '', password: '', studentId: '', role: 'student' } });

  const registerMutation = useMutation({
    mutationFn: async (values) => api.post('/auth/register', values),
    onSuccess: (response) => {
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
      toast.success(`${response.data.user.role.charAt(0).toUpperCase() + response.data.user.role.slice(1)} account created!`);
      const role = response.data.user.role;
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'technician' ? '/technician/dashboard' : '/student/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Registration failed');
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-hero-grid px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid max-w-5xl w-full items-stretch overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/70 shadow-soft backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70 lg:grid-cols-2">
        {/* Left Side: Premium Brand Context */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-ink-900 to-indigo-950 p-12 text-white lg:flex relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,77,255,0.15),transparent_45%)]" />
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-300">MaintainIQ Workspace</span>
            <h1 className="mt-6 text-4xl font-bold leading-tight">
              Scan. Report. Diagnose. Maintain.
            </h1>
            <p className="mt-6 text-slate-350 text-sm leading-relaxed">
              Create an account to scan equipment codes, instantly report complaints, check AI diagnostic findings, and follow repair logs up to final verification.
            </p>
          </div>
          <div className="mt-12 text-xs text-slate-400">
            © 2026 MaintainIQ. All rights reserved.
          </div>
        </div>

        {/* Right Side: Interactive Action Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500">Account registration</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Create your account</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Join the professional maintenance management workspace.</p>

          <form onSubmit={handleSubmit((values) => registerMutation.mutateAsync(values))} className="mt-8 space-y-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              Public sign-up creates a <strong>Student / Reporter</strong> account. Technician and admin accounts are created by an administrator from the Staff page.
            </div>
            <div>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Full name" {...register('name', { required: 'Name is required' })} />
              {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
            </div>
            <div>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Email address" {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address format'
                }
              })} />
              {errors.email ? <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p> : null}
            </div>
            <div>
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Student ID" {...register('studentId', { required: 'Student ID is required' })} />
                {errors.studentId ? <p className="mt-1 text-xs text-rose-600">{errors.studentId.message}</p> : null}
              </div>
            <div>
              <input type="password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} />
              {errors.password ? <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p> : null}
            </div>
            <button disabled={isSubmitting || registerMutation.isPending} className="w-full rounded-2xl bg-ink-900 px-4 py-3 font-medium text-white transition hover:opacity-95 dark:bg-white dark:text-ink-900 cursor-pointer">
              {isSubmitting || registerMutation.isPending ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Already have an account? <Link className="font-medium text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300" to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
