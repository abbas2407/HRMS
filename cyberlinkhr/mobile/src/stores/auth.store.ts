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
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,

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
      // silent — tokens unreadable, user will need to log in again
    } finally {
      // Always mark hydration complete so index.tsx can redirect safely
      set({ isHydrated: true });
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
