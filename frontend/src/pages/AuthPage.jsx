import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'technician' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : form;
      const response = await api.post(endpoint, payload);
      auth.setUser(response.data.user);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Authentication failed');
    }
  };

  return <div className="shell auth-shell">
    <section className="panel auth-panel">
      <p className="eyebrow">MaintainIQ</p>
      <h1>{mode === 'login' ? 'Login' : 'Create account'}</h1>
      <p className="muted">Use the seeded credentials from the backend seed script or register a fresh account.</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" />}
        <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
        <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" />
        {mode === 'register' && <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="technician">Technician</option>
          <option value="admin">Admin</option>
        </select>}
        {error && <p className="error">{error}</p>}
        <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
      <p className="muted">
        {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
        <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Register' : 'Login'}</Link>
      </p>
    </section>
  </div>;
}
