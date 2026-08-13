import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  role: string;
  employeeId?: string;
  companyId: string;
  companySlug: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,

  login: async (user, accessToken, refreshToken) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync('user', JSON.stringify(user)),
        SecureStore.setItemAsync('accessToken', accessToken),
        SecureStore.setItemAsync('refreshToken', refreshToken),
      ]);
      set({ user, accessToken, refreshToken, isAuthenticated: true });
    } catch {
      // silent fail
    }
  },

  logout: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('user'),
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('refreshToken'),
      ]);
    } catch {
      // silent fail
    }
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const [userStr, accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('refreshToken'),
      ]);
      if (userStr && accessToken) {
        set({ user: JSON.parse(userStr), accessToken, refreshToken, isAuthenticated: true });
      }
    } catch {
      // silent
    } finally {
      set({ isHydrated: true });
    }
  },
}));
