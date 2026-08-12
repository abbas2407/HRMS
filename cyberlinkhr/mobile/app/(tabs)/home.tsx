import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth.store';
import api from '@/src/lib/api';

function KpiBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color, fontSize: label === 'PAY' ? 16 : 20 }]}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function QuickRow({ icon, iconColor, iconBg, title, sub, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string; iconBg: string;
  title: string; sub: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.cardRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#e2e8f0" />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const user = useAuthStore(s => s.user);

  const { data: me, isRefetching, refetch } = useQuery<any>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const { data: leaveBalance } = useQuery<any>({
    queryKey: ['leave-balance-home'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data),
  });

  const { data: payslips } = useQuery<any[]>({
    queryKey: ['payslips-home'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data),
  });

  const { data: attendance } = useQuery<any[]>({
    queryKey: ['attendance-home', month],
    queryFn: () => api.get(`/api/attendance/my?month=${month}`).then(r => r.data.data || []),
  });

  const firstName = me?.firstName || user?.email?.split('@')[0] || 'Employee';
  const initials = `${(me?.firstName || '?')[0]}${(me?.lastName || '')[0] || ''}`.toUpperCase();

  const presentDays = (attendance || []).filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;

  const totalLeaveRemaining = Array.isArray(leaveBalance)
    ? leaveBalance.reduce((sum: number, b: any) => sum + (Number(b.remaining) || 0), 0)
    : 0;

  const lastNet = (payslips || [])[0]?.netSalary;
  const netDisplay = lastNet ? `₹${Math.round(Number(lastNet) / 1000)}k` : '—';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* KPI row */}
        <View style={styles.headerKpi}>
          <KpiBox label="PRESENT" value={String(presentDays)} sub="days this month" color="#22c55e" />
          <KpiBox label="LEAVE" value={String(totalLeaveRemaining)} sub="days remaining" color="#2563EB" />
          <KpiBox label="PAY" value={netDisplay} sub="last payslip" color="#f59e0b" />
        </View>

        {/* Quick Access */}
        <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
        <View style={styles.card}>
          <QuickRow
            icon="time-outline" iconColor="#2563EB" iconBg="#eff6ff"
            title="Punch In / Out" sub="Mark today's attendance"
            onPress={() => router.push('/(tabs)/attendance')}
          />
          <QuickRow
            icon="calendar-outline" iconColor="#22c55e" iconBg="#f0fdf4"
            title="Apply Leave" sub="Submit a leave request"
            onPress={() => router.push('/(tabs)/leave')}
          />
          <QuickRow
            icon="document-text-outline" iconColor="#ea580c" iconBg="#fff7ed"
            title="My Payslips" sub="View & download payslips"
            onPress={() => router.push('/(tabs)/payslips')}
          />
          <QuickRow
            icon="bar-chart-outline" iconColor="#9333ea" iconBg="#faf5ff"
            title="Attendance Log" sub="Monthly summary"
            onPress={() => router.push('/(tabs)/attendance')}
          />
        </View>

        {/* Announcements */}
        <Text style={styles.sectionLabel}>ANNOUNCEMENTS</Text>
        <View style={[styles.card, { marginBottom: 24 }]}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="megaphone-outline" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Welcome to CyberlinkHR</Text>
              <Text style={styles.rowSub} numberOfLines={1}>Your HRMS portal is ready</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center',
  },
  greeting: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4, marginTop: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  headerKpi: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  kpiBox: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  kpiLabel: { fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.4, marginBottom: 4 },
  kpiValue: { fontWeight: '800', letterSpacing: -0.5, lineHeight: 22 },
  kpiSub: { fontSize: 8, color: '#94a3b8', marginTop: 2 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  rowSub: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
});
