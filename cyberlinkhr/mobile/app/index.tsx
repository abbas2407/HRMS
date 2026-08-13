import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isHydrated = useAuthStore(s => s.isHydrated);

  // Wait for SecureStore to finish loading before redirecting.
  // Without this, every cold start (app killed from recents) logs the user out
  // because isAuthenticated is false until the async hydrate() completes.
  if (!isHydrated) return null;

  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/login'} />;
}
