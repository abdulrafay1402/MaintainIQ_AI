import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function AdminStaffPage() {
  const navigate = useNavigate();
  const { data: technicians = [] } = useQuery({ queryKey: ['technicians'], queryFn: async () => (await api.get('/users/technicians')).data.technicians });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data.users });

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <span>←</span> <span>Back</span>
      </button>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Staff</p>
      <h1 className="mt-2 text-3xl font-semibold">Manage people in the maintenance workflow</h1>
    </section>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold">Technicians</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Role</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {technicians.map((tech) => <tr key={tech._id}><td className="px-4 py-3">{tech.name}</td><td className="px-4 py-3">{tech.email}</td><td className="px-4 py-3">{tech.role}</td></tr>)}
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
  </div>;
}
