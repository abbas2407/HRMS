import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VendorUser {
  id: string;
  name: string;
  email: string;
}

interface VendorAuthStore {
  vendorUser: VendorUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: VendorUser, token: string) => void;
  clearAuth: () => void;
}

export const useVendorAuthStore = create<VendorAuthStore>()(
  persist(
    (set) => ({
      vendorUser: null,
      token: null,
      isAuthenticated: false,
      setAuth: (vendorUser, token) => set({ vendorUser, token, isAuthenticated: true }),
      clearAuth: () => set({ vendorUser: null, token: null, isAuthenticated: false }),
    }),
    { name: 'cyberlinkhr-vendor-auth' }
  )
);
