import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, path }: { icon: IoniconsName; label: string; path: string }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={() => router.push(path as any)}>
      <Ionicons name={icon} size={24} color="#2563EB" />
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const user = useAuthStore(s => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ['mobile-dashboard'],
    queryFn: () => api.get('/api/dashboard').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.email?.split('@')[0] || 'there';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Date */}
      <Text style={styles.dateText}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {/* KPI strip */}
      {!isLoading && data && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          <KpiCard label="Total Employees" value={data.headcount?.total ?? '—'} color="#2563EB" />
          <KpiCard label="Present Today" value={data.todayAttendance?.present ?? '—'} color="#22c55e" />
          <KpiCard label="On Leave" value={data.todayAttendance?.on_leave ?? '—'} color="#f59e0b" />
          <KpiCard label="Pending Leaves" value={data.pendingLeaves ?? '—'} color="#ef4444" />
        </ScrollView>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.qaGrid}>
          <QuickAction icon="time-outline" label="Punch In/Out" path="/(tabs)/attendance" />
          <QuickAction icon="calendar-outline" label="Apply Leave" path="/(tabs)/leave" />
          <QuickAction icon="wallet-outline" label="My Payslips" path="/(tabs)/payslips" />
          <QuickAction icon="bar-chart-outline" label="My Attendance" path="/(tabs)/attendance" />
        </View>
      </View>

      {/* Recent joiners */}
      {data?.recentJoiners?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Joiners</Text>
          {data.recentJoiners.slice(0, 5).map((e: any) => (
            <View key={e.id} style={styles.joinerRow}>
              <View style={styles.joinerAvatar}>
                <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 14 }}>
                  {e.firstName[0]}{e.lastName[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.joinerName}>{e.firstName} {e.lastName}</Text>
                <Text style={styles.joinerMeta}>{e.designationName || 'Employee'} · Joined {e.joiningDate}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 56,
    backgroundColor: '#2563EB',
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 20,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  qaLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  joinerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  joinerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinerName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  joinerMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
