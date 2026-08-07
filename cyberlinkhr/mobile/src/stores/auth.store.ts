import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  slug: string;
  companyName?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, accessToken, refreshToken) => {
    await Promise.all([
      SecureStore.setItemAsync('access_token', accessToken),
      SecureStore.setItemAsync('refresh_token', refreshToken),
      SecureStore.setItemAsync('slug', user.slug),
      SecureStore.setItemAsync('user', JSON.stringify(user)),
    ]);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
      SecureStore.deleteItemAsync('slug'),
      SecureStore.deleteItemAsync('user'),
    ]);
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const [token, userStr] = await Promise.all([
        SecureStore.getItemAsync('access_token'),
        SecureStore.getItemAsync('user'),
      ]);
      if (token && userStr) {
        set({ user: JSON.parse(userStr), isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
