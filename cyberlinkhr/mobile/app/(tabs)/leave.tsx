import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
  CANCELLED: { bg: '#f1f5f9', text: '#64748b' },
};

export default function LeaveScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState('');

  const { data: leaveTypes } = useQuery<any[]>({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/api/leave/types').then(r => r.data.data),
  });

  const { data: myLeaves, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-leaves'],
    queryFn: () => api.get('/api/leave/requests').then(r => r.data.data),
  });

  const { data: balances } = useQuery<any[]>({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data),
  });

  const applyMutation = useMutation({
    mutationFn: () => api.post('/api/leave/requests', form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowModal(false);
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      setError('');
      Alert.alert('Applied!', 'Your leave request has been submitted.');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to apply leave'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/leave/requests/${id}/cancel`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-leaves'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error || 'Failed to cancel'),
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leave</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.applyBtnText}>+ Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Leave balance */}
        {balances && balances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {balances.map((b: any) => (
                <View key={b.leaveTypeId} style={styles.balanceCard}>
                  <Text style={styles.balanceValue}>{b.balance ?? '—'}</Text>
                  <Text style={styles.balanceLabel}>{b.leaveTypeName}</Text>
                  <Text style={styles.balanceUsed}>Used: {b.used ?? 0}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* My leaves */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Requests</Text>
          {isLoading ? <ActivityIndicator color="#2563EB" /> : (
            (myLeaves || []).length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>No leave requests yet.</Text>
            ) : (myLeaves || []).map((l: any) => {
              const ss = STATUS_STYLE[l.status] || STATUS_STYLE.PENDING;
              return (
                <View key={l.id} style={styles.leaveCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={styles.leaveType}>{l.leaveTypeName}</Text>
                      <View style={{ backgroundColor: ss.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                        <Text style={{ color: ss.text, fontSize: 11, fontWeight: '700' }}>{l.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.leaveDates}>{l.startDate} → {l.endDate}</Text>
                    {l.reason ? <Text style={styles.leaveReason}>{l.reason}</Text> : null}
                    {l.reviewComment ? <Text style={[styles.leaveReason, { color: '#2563EB' }]}>Note: {l.reviewComment}</Text> : null}
                  </View>
                  {l.status === 'PENDING' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Cancel Leave?', 'Are you sure?', [
                        { text: 'No' },
                        { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(l.id) },
                      ])}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Apply modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply Leave</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setError(''); }}>
              <Text style={{ fontSize: 22, color: '#94a3b8' }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Leave Type *</Text>
            <View style={styles.pickerWrap}>
              {(leaveTypes || []).map((lt: any) => (
                <TouchableOpacity
                  key={lt.id}
                  onPress={() => setForm(f => ({ ...f, leaveTypeId: lt.id }))}
                  style={[styles.pickerItem, form.leaveTypeId === lt.id && styles.pickerItemSelected]}
                >
                  <Text style={{ color: form.leaveTypeId === lt.id ? '#fff' : '#0f172a', fontSize: 13, fontWeight: '600' }}>
                    {lt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>From Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={form.startDate}
              onChangeText={t => setForm(f => ({ ...f, startDate: t }))}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>To Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={form.endDate}
              onChangeText={t => setForm(f => ({ ...f, endDate: t }))}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Optional reason..."
              value={form.reason}
              onChangeText={t => setForm(f => ({ ...f, reason: t }))}
              multiline
            />

            {error ? <Text style={{ color: '#ef4444', marginBottom: 12 }}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, { opacity: applyMutation.isPending ? 0.6 : 1 }]}
              onPress={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              <Text style={styles.submitBtnText}>
                {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  applyBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: { marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    minWidth: 110,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceValue: { fontSize: 26, fontWeight: '800', color: '#2563EB' },
  balanceLabel: { fontSize: 12, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginTop: 2 },
  balanceUsed: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  leaveCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'flex-start',
  },
  leaveType: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  leaveDates: { fontSize: 13, color: '#64748b', marginTop: 2 },
  leaveReason: { fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 13, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc' },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  pickerItemSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
