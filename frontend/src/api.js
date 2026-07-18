import axios from 'axios';

// API base resolution order:
// 1. VITE_API_URL (local .env or Vercel env var)
// 2. If the app is running on localhost/LAN -> local backend
// 3. Otherwise (deployed anywhere) -> the production backend
// This guarantees the deployed site NEVER falls back to localhost.
const PROD_API = 'https://maintain-iq-ai-b9pk.vercel.app/api';

const resolveBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
  return isLocal ? 'http://localhost:5000/api' : PROD_API;
};

const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
