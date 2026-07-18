import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

// ── Icons ─────────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm({
    mode: 'onChange',
    defaultValues: { email: '', password: '' }
  });

  const [verificationPending, setVerificationPending] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [codeValue, setCodeValue] = useState('');

  const [forgotPasswordMode, setForgotPasswordMode] = useState(null); // 'request', 'reset', or null
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Already-authenticated visitors go straight to their dashboard.
  useEffect(() => {
    const role = auth?.user?.role;
    if (!role) return;
    navigate(role === 'admin' ? '/admin/dashboard' : role === 'technician' ? '/technician/dashboard' : '/student/dashboard', { replace: true });
  }, [auth?.user?.role, navigate]);

  const loginMutation = useMutation({
    mutationFn: async (values) => api.post('/auth/login', values),
    onSuccess: (response) => {
      // Self-registered account still waiting for the admin's decision.
      if (response.data.status === 'approval_pending') {
        setApprovalPending(true);
        return;
      }
      if (response.data.status === 'verification_pending') {
        setVerificationEmail(response.data.email);
        setVerificationPending(true);
        setResendCooldown(30);
        toast.success('Verification code sent — it expires in 1 minute');
        return;
      }
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
      // The login payload only carries id/name/email/role — pull the full
      // profile (phone, department, studentId, 2FA) so Settings never shows blanks.
      auth.refreshUser();
      toast.success('Welcome back');
      const role = response.data.user.role;
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'technician' ? '/technician/dashboard' : '/student/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Login failed');
    },
  });

  const requestResetMutation = useMutation({
    mutationFn: async (email) => api.post('/auth/forgot-password', { email }),
    onSuccess: () => {
      toast.success('Password reset code sent to email');
      setForgotPasswordMode('reset');
      setResendCooldown(60);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to send reset code');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, code, newPassword }) => api.post('/auth/reset-password', { email, code, newPassword }),
    onSuccess: () => {
      toast.success('Password reset successful. Please login with your new password.');
      setForgotPasswordMode(null);
      setResetCode('');
      setNewPassword('');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to reset password');
    },
  });

  const handleRequestResetSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    requestResetMutation.mutate(forgotEmail);
  };

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail || resetCode.length !== 6 || newPassword.length < 6) {
      toast.error('Please fill in all fields correctly (Password min 6 chars)');
      return;
    }
    resetPasswordMutation.mutate({ email: forgotEmail, code: resetCode, newPassword });
  };

  const verifyMutation = useMutation({
    mutationFn: async ({ email, code }) => api.post('/auth/verify-otp', { email, code }),
    onSuccess: (response) => {
      if (response.data.status === 'approval_pending') {
        setVerificationPending(false);
        setApprovalPending(true);
        return;
      }
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      queryClient.setQueryData(['auth', 'me'], response.data.user);
      auth.setUser(response.data.user);
      auth.refreshUser();
      toast.success('Welcome back');
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
      setResendCooldown(60);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Could not resend code');
    },
  });

  const onSubmit = (values) => loginMutation.mutateAsync(values);

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (codeValue.length !== 6) {
      toast.error('Verification code must be 6 digits');
      return;
    }
    verifyMutation.mutate({ email: verificationEmail, code: codeValue });
  };

  // ── Awaiting admin approval ────────────────────────────────────────────────
  if (approvalPending) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
        <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
        <div className="relative mx-auto max-w-md w-full rounded-[2.5rem] border border-slate-200 bg-white/60 p-8 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 z-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl dark:bg-amber-950/40">⏳</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight font-display">Request in progress</h2>
          <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            Your account request is verified and is now <strong>waiting for admin approval</strong>.
            You'll receive an email when it's accepted — then you can log in.
          </p>
          <button
            onClick={() => setApprovalPending(false)}
            className="mt-6 w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-ink-900 cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── OTP verification pending step ──────────────────────────────────────────
  if (verificationPending) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
        <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
        <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

        <div className="relative mx-auto max-w-md w-full rounded-[2.5rem] border border-slate-200 bg-white/60 p-8 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-600 dark:text-ink-400">Security Verification</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Verify Email Address</h2>
          <p className="mt-2 text-xs font-semibold text-[#475569] dark:text-[#94a3b8]">
            We sent a 6-digit OTP code to your registered email: <strong className="text-slate-900 dark:text-white">{verificationEmail}</strong>
          </p>

          <form onSubmit={handleVerifySubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                className="w-full text-center tracking-[0.5em] font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-lg outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white"
                placeholder="000000"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <button
              disabled={verifyMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {verifyMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/35 border-t-white rounded-full animate-spin-smooth" />
                  Verifying...
                </span>
              ) : 'Verify Code'}
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs font-semibold">
            <button
              onClick={() => resendMutation.mutate(verificationEmail)}
              disabled={resendMutation.isPending || resendCooldown > 0}
              className={`text-ink-600 hover:text-ink-700 underline dark:text-ink-300 cursor-pointer ${
                resendCooldown > 0 ? 'opacity-50 cursor-not-allowed no-underline' : ''
              }`}
            >
              {resendMutation.isPending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
            <button
              onClick={() => setVerificationPending(false)}
              className="text-[#475569] hover:text-slate-800 dark:text-[#94a3b8] dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password request step ────────────────────────────────────────────
  if (forgotPasswordMode === 'request') {
    return (
      <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
        <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
        <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

        <div className="relative mx-auto max-w-md w-full rounded-[2.5rem] border border-slate-200 bg-white/60 p-8 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Recovery Portal</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Forgot Password</h2>
          <p className="mt-2 text-xs font-semibold text-[#475569] dark:text-[#94a3b8]">
            Enter your email address to receive a 6-digit password reset code.
          </p>

          <form onSubmit={handleRequestResetSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white"
                placeholder="name@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>

            <button
              disabled={requestResetMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {requestResetMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/35 border-t-white rounded-full animate-spin-smooth" />
                  Sending...
                </span>
              ) : 'Send Reset Code'}
            </button>
          </form>

          <div className="mt-6 flex justify-center text-xs font-semibold">
            <button
              onClick={() => setForgotPasswordMode(null)}
              className="text-[#475569] hover:text-slate-800 dark:text-[#94a3b8] dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password reset step ──────────────────────────────────────────────
  if (forgotPasswordMode === 'reset') {
    return (
      <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
        <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
        <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

        <div className="relative mx-auto max-w-md w-full rounded-[2.5rem] border border-slate-200 bg-white/60 p-8 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 z-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Recovery Portal</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Reset Password</h2>
          <p className="mt-2 text-xs font-semibold text-[#475569] dark:text-[#94a3b8]">
            Enter the 6-digit code sent to your email and choose a new password.
          </p>

          <form onSubmit={handleResetPasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white"
                placeholder="name@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1.5 ml-1">Reset Code</label>
              <input
                type="text"
                maxLength={6}
                className="w-full text-center tracking-[0.5em] font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white"
                placeholder="000000"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1.5 ml-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer"
                >
                  <EyeIcon open={showNewPassword} />
                </button>
              </div>
            </div>

            <button
              disabled={resetPasswordMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2"
            >
              {resetPasswordMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/35 border-t-white rounded-full animate-spin-smooth" />
                  Resetting...
                </span>
              ) : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs font-semibold">
            <button
              onClick={() => requestResetMutation.mutate(forgotEmail)}
              disabled={requestResetMutation.isPending || resendCooldown > 0}
              className={`text-ink-600 hover:text-ink-700 underline dark:text-ink-300 cursor-pointer ${
                resendCooldown > 0 ? 'opacity-50 cursor-not-allowed no-underline' : ''
              }`}
            >
              {requestResetMutation.isPending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
            <button
              onClick={() => setForgotPasswordMode(null)}
              className="text-[#475569] hover:text-slate-800 dark:text-[#94a3b8] dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main split-screen login layout ─────────────────────────────────────────
  return (
    <div className="relative grid min-h-screen place-items-center bg-hero-grid px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      <div className="glow-orb bg-ink-400 h-96 w-96 -top-32 -left-32 dark:bg-ink-600/30" />
      <div className="glow-orb bg-accent-400 h-96 w-96 -bottom-32 -right-32 dark:bg-accent-600/20" />

      <div className="relative mx-auto grid max-w-5xl w-full items-stretch overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/60 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-2 z-10">

        {/* Left Side: Premium Brand Context */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-ink-900 via-indigo-950 to-slate-900 p-12 text-white lg:flex relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,77,255,0.18),transparent_55%)]" />
          <div className="absolute top-1/2 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-500/10 blur-[80px]" />

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300 dark:text-accent-300">MaintainIQ Workspace</span>
            </div>

            <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-white font-display">
              Maintenance requests with <span className="bg-gradient-to-r from-emerald-300 to-indigo-300 bg-clip-text text-transparent">QR-first</span> workflows.
            </h1>

            <p className="mt-6 text-white/70 text-sm leading-relaxed font-medium">
              Scan equipment QR codes to report faults instantly, preview automated AI triage diagnoses, verify details, and track status history securely.
            </p>
          </div>

          {/* Using text-white/40 to ensure correct contrast on dark background */}
          <div className="mt-12 text-[11px] text-white/40 font-semibold tracking-wide">
            © 2026 MaintainIQ. All rights reserved.
          </div>
        </div>

        {/* Right Side: Interactive Action Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white/40 dark:bg-slate-900/20">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500">Access Portal</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Welcome back</h2>
          <p className="mt-2 text-xs font-semibold text-[#475569] dark:text-[#cbd5e1]">Use your registered account to sign in.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                <label className="text-xs font-bold text-[#475569] dark:text-[#cbd5e1] uppercase tracking-wider block">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail('');
                    setForgotPasswordMode('request');
                  }}
                  className="text-xs font-semibold text-ink-600 hover:text-ink-700 underline dark:text-ink-300 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-3.5 text-sm outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="••••••••"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password ? <p className="mt-1 text-xs font-semibold text-rose-600 ml-1">{errors.password.message}</p> : null}
            </div>

            <button
              disabled={!isValid || isSubmitting || loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting || loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/35 border-t-white rounded-full animate-spin-smooth" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs font-semibold text-[#475569] dark:text-[#cbd5e1]">
            Don't have an account? <Link className="font-bold text-ink-600 hover:text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300" to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
