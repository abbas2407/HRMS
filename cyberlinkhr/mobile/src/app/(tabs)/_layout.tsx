import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface TabConfig {
  name: string;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  activeIcon: React.ComponentProps<typeof Ionicons>['name'];
}

const TABS: TabConfig[] = [
  { name: 'home',       title: 'Home',     icon: 'home-outline',         activeIcon: 'home' },
  { name: 'attendance', title: 'Attend.',  icon: 'time-outline',         activeIcon: 'time' },
  { name: 'leave',      title: 'Leave',    icon: 'calendar-outline',     activeIcon: 'calendar' },
  { name: 'payslips',   title: 'Pay',      icon: 'document-text-outline',activeIcon: 'document-text' },
  { name: 'profile',    title: 'Profile',  icon: 'person-outline',       activeIcon: 'person' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? t.activeIcon : t.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
