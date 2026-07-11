import { createContext, useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const AuthContext = createContext(null);
const AUTH_QUERY_KEY = ['auth', 'me'];

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get('/auth/me');
      return response.data.user;
    },
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => api.post('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });

  const value = {
    user: meQuery.data || null,
    loading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    setUser: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    refreshUser: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
    logout: () => logoutMutation.mutateAsync(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
