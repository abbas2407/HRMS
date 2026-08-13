import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import api from '../../lib/api';

export default function HomeScreen() {
  const user = useAuthStore(s => s.user);

  // Fetch self-service employee information
  const { data: me, isLoading: loadingMe } = useQuery<any>({
    queryKey: ['my-employee-profile'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  // Fetch leave balances
  const { data: leaveBalance } = useQuery<any[]>({
    queryKey: ['leave-balance-home'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data || []),
  });

  // Fetch payslips
  const { data: payslips } = useQuery<any[]>({
    queryKey: ['payslips-home'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data || []),
  });

  // Fetch attendance logs for current month
  const today = new Date().toISOString().split('T')[0];
  const [yearStr, monthStr] = today.slice(0, 7).split('-');
  const { data: attendance } = useQuery<any[]>({
    queryKey: ['attendance-home'],
    queryFn: () => api.get(`/api/attendance/my?month=${Number(monthStr)}&year=${Number(yearStr)}`).then(r => r.data.data || []),
  });

  // Fetch announcements
  const { data: announcements } = useQuery<any[]>({
    queryKey: ['announcements-home'],
    queryFn: () => api.get('/api/announcements').then(r => r.data.data || []),
  });

  const fullName = me ? `${me.firstName} ${me.lastName || ''}`.trim() : (user?.email?.split('@')[0] || 'Employee');
  const initials = me ? `${me.firstName?.[0] || ''}${me.lastName?.[0] || ''}`.toUpperCase() : '??';

  const presentDays = (attendance || []).filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;

  const totalLeaveRemaining = Array.isArray(leaveBalance)
    ? leaveBalance.reduce((sum: number, b: any) => sum + (Number(b.remaining ?? b.balance ?? 0)), 0)
    : 12; // default fallback if empty

  const lastNet = (payslips || [])[0]?.netSalary;
  const netDisplay = lastNet ? `₹${Math.round(Number(lastNet) / 1000)}k` : '₹45k';

  // Determine greeting based on current time
  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,';

  if (loadingMe) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Greeting Row */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.nameText}>{fullName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Stats Grid Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#22c55e' }]}>{presentDays}</Text>
            <Text style={styles.statSub}>days this month</Text>
            <Text style={styles.statLabel}>PRESENT</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#2563eb' }]}>{totalLeaveRemaining}</Text>
            <Text style={styles.statSub}>days remaining</Text>
            <Text style={styles.statLabel}>LEAVE</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#d97706' }]}>{netDisplay}</Text>
            <Text style={styles.statSub}>last payslip</Text>
            <Text style={styles.statLabel}>PAY</Text>
          </View>
        </View>

        {/* Quick Access Section */}
        <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="time-outline" size={20} color="#2563eb" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Punch In / Out</Text>
              <Text style={styles.rowSub}>Mark today's attendance</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => router.push('/(tabs)/leave')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="calendar-outline" size={20} color="#22c55e" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Apply Leave</Text>
              <Text style={styles.rowSub}>Submit a leave request</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => router.push('/(tabs)/payslips')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="document-text-outline" size={20} color="#ea580c" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>My Payslips</Text>
              <Text style={styles.rowSub}>View & download payslips</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#faf5ff' }]}>
              <Ionicons name="bar-chart-outline" size={20} color="#9333ea" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Attendance Log</Text>
              <Text style={styles.rowSub}>Monthly summary</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Announcements Section */}
        <Text style={styles.sectionTitle}>ANNOUNCEMENTS</Text>
        <View style={styles.cardContainer}>
          {announcements && announcements.length > 0 ? (
            announcements.map((item, idx) => {
              const colors = idx % 2 === 0
                ? { bg: '#eff6ff', color: '#2563eb' }
                : { bg: '#fff7ed', color: '#ea580c' };
              const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
              });

              return (
                <View key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.cardRow}>
                    <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                      <Ionicons name="paper-plane-outline" size={20} color={colors.color} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowSub}>{dateStr} — {item.body || ''}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <>
              {/* Default Mock Data when DB has no announcements */}
              <View style={styles.cardRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="paper-plane-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Independence Day Holiday</Text>
                  <Text style={styles.rowSub}>15th August — office closed</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardRow}>
                <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="paper-plane-outline" size={20} color="#ea580c" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>July Payroll Update</Text>
                  <Text style={styles.rowSub}>Salaries credited by 5th August</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});
