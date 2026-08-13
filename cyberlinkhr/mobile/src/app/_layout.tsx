import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../stores/auth.store';
import api from '../lib/api';

const queryClient = new QueryClient();

async function registerPushToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    await api.post('/api/devices/register', { token, platform: 'expo' });
  } catch {
    // non-critical
  }
}

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isHydrated = useAuthStore(s => s.isHydrated);
  const notifListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isHydrated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    registerPushToken();
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
