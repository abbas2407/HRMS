import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'EARNED', label: 'Earned Leave' },
];

export default function LeaveScreen() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');

  // Fetch balances
  const { data: balance = [], isLoading: loadingBalance } = useQuery<any[]>({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data || []),
  });

  // Fetch leave requests
  const { data: requests = [], isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/api/leave/requests').then(r => r.data.data || []),
  });

  // Submit leave request mutation
  const submitLeave = useMutation({
    mutationFn: (data: { type: string; from: string; to: string; reason: string }) =>
      api.post('/api/leave/requests', data),
    onSuccess: () => {
      Alert.alert('Success', 'Leave request submitted successfully');
      setModalOpen(false);
      setFrom('');
      setTo('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      qc.invalidateQueries({ queryKey: ['leave-balance-home'] });
    },
    onError: (err: any) => {
      Alert.alert('Submission Failed', err.response?.data?.error || 'Failed to submit leave request');
    },
  });

  const handleApply = () => {
    if (!from || !to || !reason) {
      Alert.alert('Error', 'Please fill in all fields (YYYY-MM-DD)');
      return;
    }
    submitLeave.mutate({ type: leaveType, from, to, reason });
  };

  const getBalanceItem = (type: string) => {
    return balance.find((b: any) => b.type === type) || {
      balance: 10,
      used: 0,
      remaining: 10,
    };
  };

  // Find balance values
  const casual = getBalanceItem('CASUAL');
  const sick = getBalanceItem('SICK');
  const earned = getBalanceItem('EARNED');

  const formatDaysText = (f: string, t: string) => {
    try {
      const d1 = new Date(f);
      const d2 = new Date(t);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } catch {
      return '1 day';
    }
  };

  const formatLeaveDates = (f: string, t: string) => {
    try {
      const d1 = new Date(f);
      const d2 = new Date(t);
      const options: any = { month: 'short', day: 'numeric' };
      if (f === t) {
        return d1.toLocaleDateString('en-US', options) + `, ${d1.getFullYear()}`;
      }
      if (d1.getMonth() === d2.getMonth()) {
        return `${d1.toLocaleDateString('en-US', { day: 'numeric' })}–${d2.toLocaleDateString('en-US', { day: 'numeric' })} ${d1.toLocaleDateString('en-US', { month: 'short' })}, ${d1.getFullYear()}`;
      }
      return `${d1.toLocaleDateString('en-US', options)}–${d2.toLocaleDateString('en-US', options)}, ${d1.getFullYear()}`;
    } catch {
      return `${f} to ${t}`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-outline" size={16} color="#ffffff" style={{ marginRight: 2 }} />
          <Text style={styles.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* LEAVE BALANCE */}
        <Text style={styles.sectionTitle}>LEAVE BALANCE</Text>

        <View style={styles.balanceRow}>
          {/* CASUAL */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>CASUAL</Text>
            <Text style={[styles.balanceNum, { color: '#2563eb' }]}>
              {casual.remaining ?? casual.balance}
            </Text>
            <Text style={styles.balanceSub}>
              {casual.used} used / {casual.balance} total
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: '#2563eb',
                    width: `${Math.min(100, (Number(casual.used) / Number(casual.balance)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* SICK */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>SICK</Text>
            <Text style={[styles.balanceNum, { color: '#22c55e' }]}>
              {sick.remaining ?? sick.balance}
            </Text>
            <Text style={styles.balanceSub}>
              {sick.used} used / {sick.balance} total
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: '#22c55e',
                    width: `${Math.min(100, (Number(sick.used) / Number(sick.balance)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* EARNED */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>EARNED</Text>
            <Text style={[styles.balanceNum, { color: '#9333ea' }]}>
              {earned.remaining ?? earned.balance}
            </Text>
            <Text style={styles.balanceSub}>
              {earned.used} used / {earned.balance} total
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: '#9333ea',
                    width: `${Math.min(100, (Number(earned.used) / Number(earned.balance)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* RECENT REQUESTS */}
        <Text style={styles.sectionTitle}>RECENT REQUESTS</Text>

        <View style={styles.requestsCard}>
          {loadingRequests ? (
            <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} />
          ) : requests && requests.length > 0 ? (
            requests.map((item, idx) => {
              let badgeColor = '#94a3b8';
              let badgeBg = '#f1f5f9';
              if (item.status === 'APPROVED') {
                badgeColor = '#22c55e';
                badgeBg = '#f0fdf4';
              } else if (item.status === 'REJECTED') {
                badgeColor = '#ef4444';
                badgeBg = '#fef2f2';
              } else if (item.status === 'PENDING') {
                badgeColor = '#ea580c';
                badgeBg = '#fff7ed';
              }

              const typeLabel =
                LEAVE_TYPES.find((t) => t.value === item.type)?.label || item.type;
              const dateRange = formatLeaveDates(item.from, item.to);
              const duration = formatDaysText(item.from, item.to);

              return (
                <View key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.requestRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                      <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{typeLabel}</Text>
                      <Text style={styles.rowSub}>
                        {dateRange} • {duration}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <>
              {/* Default Mock Data when DB is empty */}
              <View style={styles.requestRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Casual Leave</Text>
                  <Text style={styles.rowSub}>Aug 15, 2026 • 1 day</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>APPROVED</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.requestRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Sick Leave</Text>
                  <Text style={styles.rowSub}>Jul 22–23, 2026 • 2 days</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>APPROVED</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.requestRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Earned Leave</Text>
                  <Text style={styles.rowSub}>Jun 10–12, 2026 • 3 days</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#fef2f2' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>REJECTED</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.requestRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Casual Leave</Text>
                  <Text style={styles.rowSub}>May 1, 2026 • 1 day</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#fff7ed' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#ea580c' }]}>PENDING</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Leave</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Type selector */}
            <Text style={styles.modalLabel}>LEAVE TYPE</Text>
            <View style={styles.pickerRow}>
              {LEAVE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.pickerBtn,
                    leaveType === t.value && styles.pickerBtnActive,
                  ]}
                  onPress={() => setLeaveType(t.value)}
                >
                  <Text
                    style={[
                      styles.pickerBtnText,
                      leaveType === t.value && styles.pickerBtnTextActive,
                    ]}
                  >
                    {t.label.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dates */}
            <Text style={styles.modalLabel}>START DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={from}
              onChangeText={setFrom}
              placeholder="e.g. 2026-08-15"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>END DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={to}
              onChangeText={setTo}
              placeholder="e.g. 2026-08-16"
              placeholderTextColor="#94a3b8"
            />

            {/* Reason */}
            <Text style={styles.modalLabel}>REASON FOR LEAVE</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Provide reason detail..."
              placeholderTextColor="#94a3b8"
              multiline
            />

            {/* Submit */}
            <TouchableOpacity style={styles.modalSubmit} onPress={handleApply} activeOpacity={0.8}>
              <Text style={styles.modalSubmitText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceNum: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  balanceSub: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  requestsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
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
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pickerBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  pickerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  pickerBtnTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalSubmit: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
