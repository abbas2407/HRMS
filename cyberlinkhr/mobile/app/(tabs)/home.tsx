import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_ACTIONS: { icon: IoniconsName; iconColor: string; iconBg: string; title: string; sub: string; path: string }[] = [
  { icon: 'time-outline', iconColor: '#2563eb', iconBg: '#eff6ff', title: 'Punch In / Out', sub: 'Mark today\'s attendance', path: '/(tabs)/attendance' },
  { icon: 'calendar-outline', iconColor: '#16a34a', iconBg: '#f0fdf4', title: 'Apply Leave', sub: 'Submit a leave request', path: '/(tabs)/leave' },
  { icon: 'document-text-outline', iconColor: '#ea580c', iconBg: '#fff7ed', title: 'My Payslips', sub: 'View & download payslips', path: '/(tabs)/payslips' },
  { icon: 'bar-chart-outline', iconColor: '#9333ea', iconBg: '#faf5ff', title: 'Attendance Log', sub: 'Monthly summary', path: '/(tabs)/attendance' },
];

export default function HomeScreen() {
  const user = useAuthStore(s => s.user);

  const { data, isRefetching, refetch } = useQuery<any>({
    queryKey: ['mobile-dashboard'],
    queryFn: () => api.get('/api/dashboard').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: leaveBalance } = useQuery<any[]>({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data),
  });

  const { data: myPayslips } = useQuery<any[]>({
    queryKey: ['my-payslips'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data),
  });

  const { data: myAttendance } = useQuery<any[]>({
    queryKey: ['my-attendance-month', new Date().toISOString().slice(0, 7)],
    queryFn: () => api.get(`/api/attendance/my?month=${new Date().toISOString().slice(0, 7)}`).then(r => r.data.data),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  })();

  const displayName = user?.name || user?.email?.split('@')[0] || 'there';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const presentDays = (myAttendance || []).filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const totalLeaveBalance = (leaveBalance || []).reduce((sum: number, b: any) => sum + (Number(b.balance) || 0), 0);
  const lastPay = myPayslips?.[0]?.netSalary ? Number(myPayslips[0].netSalary) : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
        </View>

        {/* KPI row — employee focused */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <View style={styles.kpiLabelRow}>
              <Text style={styles.kpiLabel}>PRESENT</Text>
              <Ionicons name="person-outline" size={11} color="#22c55e" />
            </View>
            <Text style={[styles.kpiVal, { color: '#22c55e' }]}>{presentDays}</Text>
            <Text style={styles.kpiSub}>days this month</Text>
          </View>
          <View style={styles.kpi}>
            <View style={styles.kpiLabelRow}>
              <Text style={styles.kpiLabel}>LEAVE</Text>
              <Ionicons name="calendar-outline" size={11} color="#2563eb" />
            </View>
            <Text style={[styles.kpiVal, { color: '#2563eb' }]}>{totalLeaveBalance}</Text>
            <Text style={styles.kpiSub}>days remaining</Text>
          </View>
          <View style={styles.kpi}>
            <View style={styles.kpiLabelRow}>
              <Text style={styles.kpiLabel}>PAY</Text>
              <Ionicons name="cash-outline" size={11} color="#f59e0b" />
            </View>
            <Text style={[styles.kpiVal, { color: '#f59e0b', fontSize: 14 }]}>
              {lastPay ? `₹${Math.round(lastPay / 1000)}k` : '—'}
            </Text>
            <Text style={styles.kpiSub}>last payslip</Text>
          </View>
        </View>
      </View>

      {/* Quick Access */}
      <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
      <View style={styles.card}>
        {QUICK_ACTIONS.map((action, i) => (
          <TouchableOpacity
            key={action.title}
            style={[styles.qaItem, i === QUICK_ACTIONS.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => router.push(action.path as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: action.iconBg }]}>
              <Ionicons name={action.icon} size={18} color={action.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qaTitle}>{action.title}</Text>
              <Text style={styles.qaSub}>{action.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Announcements */}
      {data?.announcements?.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>ANNOUNCEMENTS</Text>
          <View style={styles.card}>
            {data.announcements.slice(0, 3).map((a: any, i: number) => (
              <View key={a.id} style={[styles.announcementItem, i === 2 && { borderBottomWidth: 0 }]}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="megaphone-outline" size={16} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qaTitle}>{a.title}</Text>
                  <Text style={styles.qaSub} numberOfLines={1}>{a.content}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4, marginTop: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  kpiLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  kpiLabel: { fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.4 },
  kpiVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  kpiSub: { fontSize: 8, color: '#94a3b8', marginTop: 1 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  qaTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  qaSub: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
});
