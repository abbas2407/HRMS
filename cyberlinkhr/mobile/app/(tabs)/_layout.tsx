import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ focused, name, label }: { focused: boolean; name: IoniconsName; label: string }) {
  return (
    <Ionicons
      name={focused ? name : (name + '-outline') as IoniconsName}
      size={24}
      color={focused ? '#2563EB' : '#94a3b8'}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          tabBarLabel: 'Attend',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="time" label="Attend" />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          tabBarLabel: 'Leave',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="calendar" label="Leave" />,
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          tabBarLabel: 'Pay',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="wallet" label="Pay" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="person" label="Profile" />,
        }}
      />
    </Tabs>
  );
}
