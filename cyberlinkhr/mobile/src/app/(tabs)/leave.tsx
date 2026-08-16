import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal, TextInput, Platform, StatusBar as RNStatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import DatePickerModal, { formatToDDMMYYYY } from '../../components/DatePickerModal';

const LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'EARNED', label: 'Earned Leave' },
];

export default function LeaveScreen() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [from, setFrom] = useState(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);

  // Fetch balances
  const { data: balance = [], isLoading: loadingBalance, refetch: refetchBalance } = useQuery<any[]>({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data || []),
    refetchInterval: 10000,
  });

  // Fetch leave types from backend
  const { data: realLeaveTypes = [] } = useQuery<any[]>({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/api/leave/types').then(r => r.data.data || []).catch(() => []),
  });

  // Fetch leave requests
  const { data: requests = [], isLoading: loadingRequests, refetch: refetchRequests } = useQuery<any[]>({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/api/leave/requests').then(r => r.data.data || []),
    refetchInterval: 10000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchRequests()]);
    setRefreshing(false);
  }, [refetchBalance, refetchRequests]);

  // Submit leave request mutation
  const submitLeave = useMutation({
    mutationFn: (data: any) =>
      api.post('/api/leave/requests', data).catch(() => api.post('/api/leaves', data)),
    onSuccess: () => {
      Alert.alert('Success', 'Leave request submitted successfully');
      setModalOpen(false);
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
    if (!from || !to || !reason.trim()) {
      Alert.alert('Error', 'Please fill in reason and select valid dates');
      return;
    }

    const matchedType = realLeaveTypes.find((lt: any) =>
      lt.code?.toUpperCase() === leaveType || lt.name?.toUpperCase().includes(leaveType)
    );
    const leaveTypeId = matchedType?.id || '00000000-0000-0000-0000-000000000001';

    submitLeave.mutate({
      leaveTypeId,
      startDate: from,
      endDate: to,
      type: leaveType,
      from,
      to,
      reason: reason.trim(),
    });
  };

  const getBalanceItem = (type: string) => {
    return balance.find((b: any) => b.type === type) || {
      balance: 10,
      used: 0,
      remaining: 10,
    };
  };

  const casual = getBalanceItem('CASUAL');
  const sick = getBalanceItem('SICK');
  const earned = getBalanceItem('EARNED');

  const formatDaysText = (f?: string, t?: string) => {
    if (!f || !t) return '1 day';
    try {
      const d1 = new Date(f);
      const d2 = new Date(t);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '1 day';
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } catch {
      return '1 day';
    }
  };

  const formatLeaveDates = (f?: string, t?: string) => {
    if (!f && !t) return 'Date unavailable';
    const startStr = f || t;
    const endStr = t || f;
    try {
      const d1 = new Date(startStr!);
      const d2 = new Date(endStr!);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return `${startStr} to ${endStr}`;
      const options: any = { month: 'short', day: 'numeric' };
      if (startStr === endStr) {
        return d1.toLocaleDateString('en-US', options) + `, ${d1.getFullYear()}`;
      }
      if (d1.getMonth() === d2.getMonth()) {
        return `${d1.toLocaleDateString('en-US', { day: 'numeric' })}–${d2.toLocaleDateString('en-US', { day: 'numeric' })} ${d1.toLocaleDateString('en-US', { month: 'short' })}, ${d1.getFullYear()}`;
      }
      return `${d1.toLocaleDateString('en-US', options)}–${d2.toLocaleDateString('en-US', options)}, ${d1.getFullYear()}`;
    } catch {
      return `${startStr} to ${endStr}`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        <Text style={styles.sectionTitle}>LEAVE BALANCE</Text>

        <View style={styles.balanceRow}>
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

              const typeLabel = item.leaveTypeName || LEAVE_TYPES.find((t) => t.value === item.type)?.label || item.type || 'Leave Request';
              const startDate = item.startDate || item.from;
              const endDate = item.endDate || item.to;
              const dateRange = formatLeaveDates(startDate, endDate);
              const duration = item.daysCount ? `${item.daysCount} day${Number(item.daysCount) > 1 ? 's' : ''}` : formatDaysText(startDate, endDate);

              return (
                <View key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.requestRow}
                    onPress={() => setSelectedRequest(item)}
                    activeOpacity={0.7}
                  >
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
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No recent leave requests</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Leave Detail Modal */}
      {selectedRequest && (
        <Modal visible={!!selectedRequest} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Leave Details</Text>
                <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={{ marginVertical: 12, alignItems: 'center' }}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      paddingHorizontal: 16,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor:
                        selectedRequest.status === 'APPROVED'
                          ? '#f0fdf4'
                          : selectedRequest.status === 'REJECTED'
                          ? '#fef2f2'
                          : '#fff7ed',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        fontSize: 14,
                        fontWeight: '700',
                        color:
                          selectedRequest.status === 'APPROVED'
                            ? '#22c55e'
                            : selectedRequest.status === 'REJECTED'
                            ? '#ef4444'
                            : '#ea580c',
                      },
                    ]}
                  >
                    STATUS: {selectedRequest.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>LEAVE TYPE</Text>
              <Text style={[styles.datePickerBtnText, { marginBottom: 14, color: '#0f172a' }]}>
                {selectedRequest.leaveTypeName || selectedRequest.type || 'Leave'}
              </Text>

              <Text style={styles.modalLabel}>DATES & DURATION</Text>
              <Text style={[styles.datePickerBtnText, { marginBottom: 14, color: '#0f172a' }]}>
                {formatLeaveDates(selectedRequest.startDate || selectedRequest.from, selectedRequest.endDate || selectedRequest.to)}
                {' ('}
                {selectedRequest.daysCount
                  ? `${selectedRequest.daysCount} day(s)`
                  : formatDaysText(selectedRequest.startDate || selectedRequest.from, selectedRequest.endDate || selectedRequest.to)}
                {')'}
              </Text>

              <Text style={styles.modalLabel}>REASON</Text>
              <Text style={[styles.datePickerBtnText, { marginBottom: 14, color: '#475569' }]}>
                {selectedRequest.reason || 'No reason provided'}
              </Text>

              {selectedRequest.reviewComment ? (
                <>
                  <Text style={styles.modalLabel}>APPROVER COMMENT</Text>
                  <Text style={[styles.datePickerBtnText, { marginBottom: 14, color: '#2563eb' }]}>
                    {selectedRequest.reviewComment}
                  </Text>
                </>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, { marginTop: 12 }]}
                onPress={() => setSelectedRequest(null)}
              >
                <Text style={styles.submitBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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

            {/* Dates with Calendar Picker Button */}
            <Text style={styles.modalLabel}>START DATE (DD-MM-YYYY)</Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setDatePickerTarget('from')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color="#2563eb" style={{ marginRight: 8 }} />
              <Text style={styles.datePickerBtnText}>{formatToDDMMYYYY(from)}</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>END DATE (DD-MM-YYYY)</Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setDatePickerTarget('to')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color="#2563eb" style={{ marginRight: 8 }} />
              <Text style={styles.datePickerBtnText}>{formatToDDMMYYYY(to)}</Text>
            </TouchableOpacity>

            {/* Reason */}
            <Text style={styles.modalLabel}>REASON FOR LEAVE</Text>
            <TextInput
              style={[styles.modalInput, styles.reasonInput]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Family function, sick leave"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitLeave.isPending && { opacity: 0.8 }]}
              onPress={handleApply}
              disabled={submitLeave.isPending}
            >
              {submitLeave.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={datePickerTarget === 'from' ? from : to}
        onSelect={d => {
          if (datePickerTarget === 'from') {
            setFrom(d);
            if (to < d) setTo(d);
          } else if (datePickerTarget === 'to') {
            setTo(d);
          }
        }}
        onClose={() => setDatePickerTarget(null)}
        title={datePickerTarget === 'from' ? 'Select Start Date' : 'Select End Date'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
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
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  datePickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  reasonInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
