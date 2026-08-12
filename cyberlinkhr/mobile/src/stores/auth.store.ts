import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  slug: string;
  companyName: string;
  employeeId?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

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
    }
  },

  login: async (user, accessToken, refreshToken) => {
    await Promise.all([
      SecureStore.setItemAsync('user', JSON.stringify(user)),
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
    ]);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
    ]);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
