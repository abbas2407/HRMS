import axios from 'axios';
import { useVendorAuthStore } from '@/stores/vendor-auth.store';

const vendorApi = axios.create({
  baseURL: '/api/vendor',
  headers: { 'Content-Type': 'application/json' },
});

vendorApi.interceptors.request.use((config) => {
  const token = useVendorAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

vendorApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useVendorAuthStore.getState().clearAuth();
      window.location.href = '/vendor/login';
    }
    return Promise.reject(err);
  }
);

export default vendorApi;
