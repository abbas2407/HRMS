import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}

const TABS: TabConfig[] = [
  { name: 'home',       title: 'Home',     icon: 'home-outline',         activeIcon: 'home' },
  { name: 'attendance', title: 'Attend.',  icon: 'time-outline',         activeIcon: 'time' },
  { name: 'leave',      title: 'Leave',    icon: 'calendar-outline',     activeIcon: 'calendar' },
  { name: 'payslips',   title: 'Pay',      icon: 'document-text-outline',activeIcon: 'document-text' },
  { name: 'profile',    title: 'Profile',  icon: 'person-outline',       activeIcon: 'person' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f1f5f9',
          borderTopWidth: 1,
          paddingBottom: 22,
          paddingTop: 8,
          height: 72,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
      }}
    >
      {TABS.map(t => (
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
