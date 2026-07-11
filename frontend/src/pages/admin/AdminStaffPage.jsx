import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

export default function AdminStaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: technicians = [] } = useQuery({ queryKey: ['technicians'], queryFn: async () => (await api.get('/users/technicians')).data.technicians });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data.users });

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

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <span>←</span> <span>Back</span>
      </button>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Staff</p>
      <h1 className="mt-2 text-3xl font-semibold">Manage people in the maintenance workflow</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Public sign-up only creates student/reporter accounts. Technicians and admins are onboarded here.</p>
    </section>

    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Create staff account</h2>
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="mt-5 space-y-4">
          <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" {...register('role', { required: true })}>
            <option value="technician">Technician</option>
            <option value="admin">Administrator</option>
          </select>
          <div>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Full name" {...register('name', { required: 'Name is required' })} />
            {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Email address" {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address format' },
            })} />
            {errors.email ? <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p> : null}
          </div>
          <div>
            <input type="password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Temporary password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} />
            {errors.password ? <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p> : null}
          </div>
          {selectedRole === 'technician' ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Expertise areas (used by AI technician matching)</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {EXPERTISE_OPTIONS.map((category) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value={category} {...register('expertise')} className="rounded border-slate-300 text-ink-600 focus:ring-ink-500" />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <button disabled={isSubmitting || createMutation.isPending} className="w-full rounded-2xl bg-ink-900 px-4 py-3 font-medium text-white dark:bg-white dark:text-ink-900">
            {createMutation.isPending ? 'Creating...' : 'Create account'}
          </button>
        </form>
      </section>

      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Technicians</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Expertise</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {technicians.map((tech) => <tr key={tech._id}>
                  <td className="px-4 py-3">{tech.name}</td>
                  <td className="px-4 py-3">{tech.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{tech.expertise?.length ? tech.expertise.join(', ') : 'General'}</td>
                </tr>)}
                {technicians.length === 0 ? <tr><td colSpan={3} className="px-4 py-4 text-sm text-slate-500">No technicians yet — create the first one on the left.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">All active users</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {users.map((user) => <div key={user._id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">{user.name} · {user.email} · {user.role}</div>)}
          </div>
        </section>
      </div>
    </div>
  </div>;
}
