import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const EXPERTISE_OPTIONS = [
  'Electronics / IT',
  'Electrical',
  'HVAC / Air Conditioning',
  'Plumbing',
  'Mechanical / Furniture',
  'Safety & Security',
  'Lab Equipment'
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState('student'); // 'student' or 'technician'
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [codeValue, setCodeValue] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ 
    defaultValues: { name: '', email: '', password: '', studentId: '', role: 'student', expertise: [] } 
  });

  const registerMutation = useMutation({
    mutationFn: async (values) => {
      const data = {
        ...values,
        role: selectedRole,
        expertise: selectedRole === 'technician' ? values.expertise : []
      };
      return api.post('/auth/register', data);
    },
    onSuccess: (response) => {
      if (response.data.status === 'verification_pending') {
        setVerificationEmail(response.data.email);
        setVerificationPending(true);
        toast.success('Verification code sent to your email!');
        return;
      }
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
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

  const verifyMutation = useMutation({
    mutationFn: async ({ email, code }) => api.post('/auth/verify-otp', { email, code }),
    onSuccess: (response) => {
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
      toast.success('Email verified successfully!');
      const role = response.data.user.role;
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'technician' ? '/technician/dashboard' : '/student/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Verification failed');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email) => api.post('/auth/resend-otp', { email }),
    onSuccess: () => {
      toast.success('A new verification code has been sent');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Could not resend code');
    },
  });

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (codeValue.length !== 6) {
      toast.error('Verification code must be 6 digits');
      return;
    }
    verifyMutation.mutate({ email: verificationEmail, code: codeValue });
  };

  if (verificationPending) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
        {/* Visual Ambient Orbs */}
        <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
        <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

        <div className="relative mx-auto max-w-md w-full rounded-[2.5rem] border border-slate-200 bg-white/60 p-8 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Security Verification</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Verify Email Address</h2>
          <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            We sent a 6-digit OTP code to your registered email: <strong>{verificationEmail}</strong>
          </p>

          <form onSubmit={handleVerifySubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Verification Code</label>
              <input 
                type="text"
                maxLength={6}
                className="w-full text-center tracking-[0.5em] font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-lg outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="000000"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <button 
              disabled={verifyMutation.isPending}
              className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs font-semibold">
            <button 
              onClick={() => resendMutation.mutate(verificationEmail)}
              disabled={resendMutation.isPending}
              className="text-ink-600 hover:text-ink-700 underline dark:text-ink-300 cursor-pointer"
            >
              {resendMutation.isPending ? 'Sending...' : 'Resend Code'}
            </button>
            <button 
              onClick={() => setVerificationPending(false)}
              className="text-slate-400 hover:text-slate-500 dark:text-slate-500 cursor-pointer"
            >
              Back to Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      {/* Visual Ambient Orbs */}
      <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
      <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

      <div className="relative mx-auto grid max-w-5xl w-full items-stretch overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/60 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-2 z-10">
        
        {/* Left Side: Premium Brand Context */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-ink-900 to-indigo-950 p-12 text-white lg:flex relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,77,255,0.18),transparent_55%)]" />
          <div className="absolute top-1/2 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-500/10 blur-[80px]" />
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-accent-300">MaintainIQ Workspace</span>
            </div>
            
            <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-white font-display">
              Scan. Report. Diagnose. Maintain.
            </h1>
            
            <p className="mt-6 text-slate-350 text-sm leading-relaxed font-medium">
              Create an account to scan equipment codes, instantly report complaints, check AI diagnostic findings, and follow repair logs up to final verification.
            </p>
          </div>
          
          <div className="mt-12 text-[11px] text-slate-400 font-semibold tracking-wide">
            © 2026 MaintainIQ. All rights reserved.
          </div>
        </div>

        {/* Right Side: Interactive Action Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white/40 dark:bg-slate-900/20">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Account registration</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Create account</h2>
          <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">Join the professional maintenance workspace.</p>

          <form onSubmit={handleSubmit((values) => registerMutation.mutateAsync(values))} className="mt-6 space-y-4">
            
            {/* Role Selection Tabs */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Register as</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedRole('student')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition ${selectedRole === 'student' ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                >
                  Student / Reporter
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('technician')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition ${selectedRole === 'technician' ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                >
                  Technician
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
              <input 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="John Doe" 
                {...register('name', { required: 'Name is required' })} 
              />
              {errors.name ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.name.message}</p> : null}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
              <input 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="john@example.com" 
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address format'
                  }
                })} 
              />
              {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.email.message}</p> : null}
            </div>

            {/* Student ID field visible only for Student role */}
            {selectedRole === 'student' && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Student ID / Member ID</label>
                <input 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                  placeholder="STU-12345" 
                  {...register('studentId', { required: selectedRole === 'student' ? 'Student ID is required' : false })} 
                />
                {errors.studentId ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.studentId.message}</p> : null}
              </div>
            )}

            {/* Expertise tag mapping visible only for Technician role */}
            {selectedRole === 'technician' && (
              <div className="space-y-2 rounded-2xl border border-slate-150 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-950/20">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Expertise tags (Check all that apply)</p>
                <div className="grid grid-cols-1 gap-2 text-xs text-slate-650 dark:text-slate-350 sm:grid-cols-2">
                  {EXPERTISE_OPTIONS.map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input 
                        type="checkbox" 
                        value={category} 
                        {...register('expertise')} 
                        className="rounded border-slate-300 text-ink-600 focus:ring-ink-500 h-4 w-4" 
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Password</label>
              <input 
                type="password" 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" 
                placeholder="••••••••" 
                {...register('password', { 
                  required: 'Password is required', 
                  minLength: { value: 6, message: 'Minimum 6 characters' } 
                })} 
              />
              {errors.password ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.password.message}</p> : null}
            </div>

            <button 
              disabled={isSubmitting || registerMutation.isPending} 
              className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {isSubmitting || registerMutation.isPending ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-xs font-semibold text-slate-400 dark:text-slate-500">
            Already have an account? <Link className="font-bold text-ink-600 hover:text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300" to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
