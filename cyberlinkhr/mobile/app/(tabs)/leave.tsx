import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: '#fef9c3', text: '#854d0e' },
  APPROVED:  { bg: '#dcfce7', text: '#15803d' },
  REJECTED:  { bg: '#fee2e2', text: '#991b1b' },
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

  function openModal() {
    setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
    setError('');
    setShowModal(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Leave</Text>
            <Text style={styles.headerSub}>Manage your leave requests</Text>
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={openModal}>
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Leave Balance */}
        {balances && balances.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>LEAVE BALANCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 4 }}>
              {balances.map((b: any) => (
                <View key={b.leaveTypeId} style={styles.balCard}>
                  <Text style={[styles.balVal, { color: '#2563eb' }]}>{b.balance ?? '—'}</Text>
                  <Text style={styles.balLabel}>{b.leaveTypeName}</Text>
                  <Text style={styles.balUsed}>Used: {b.used ?? 0}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Requests */}
        <Text style={styles.sectionLabel}>MY REQUESTS</Text>
        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.card}>
            {(myLeaves || []).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={32} color="#cbd5e1" />
                <Text style={styles.emptyText}>No leave requests yet.</Text>
              </View>
            ) : (myLeaves || []).map((l: any, i: number, arr: any[]) => {
              const ss = STATUS_STYLE[l.status] || STATUS_STYLE.PENDING;
              return (
                <View key={l.id} style={[styles.leaveItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={styles.leaveType}>{l.leaveTypeName}</Text>
                      <View style={{ backgroundColor: ss.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                        <Text style={{ color: ss.text, fontSize: 10, fontWeight: '700' }}>{l.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.leaveDates}>
                      {l.startDate} → {l.endDate}
                      {l.daysCount ? ` · ${l.daysCount} day${Number(l.daysCount) !== 1 ? 's' : ''}` : ''}
                    </Text>
                    {l.reason ? <Text style={styles.leaveReason}>{l.reason}</Text> : null}
                    {l.reviewComment ? <Text style={[styles.leaveReason, { color: '#2563EB' }]}>Note: {l.reviewComment}</Text> : null}
                  </View>
                  {l.status === 'PENDING' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Cancel Leave?', 'Are you sure you want to cancel this request?', [
                        { text: 'No' },
                        { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(l.id) },
                      ])}
                      style={{ padding: 6 }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Apply Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowModal(false); setError(''); }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply Leave</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); setError(''); }} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.fieldLabel}>Leave Type</Text>
            <View style={styles.typePicker}>
              {(leaveTypes || []).map((lt: any) => (
                <TouchableOpacity
                  key={lt.id}
                  onPress={() => setForm(f => ({ ...f, leaveTypeId: lt.id }))}
                  style={[styles.typeChip, form.leaveTypeId === lt.id && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, form.leaveTypeId === lt.id && { color: '#fff' }]}>
                    {lt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>From Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#cbd5e1"
                  value={form.startDate}
                  onChangeText={t => setForm(f => ({ ...f, startDate: t }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>To Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#cbd5e1"
                  value={form.endDate}
                  onChangeText={t => setForm(f => ({ ...f, endDate: t }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Briefly describe the reason…"
              placeholderTextColor="#cbd5e1"
              value={form.reason}
              onChangeText={t => setForm(f => ({ ...f, reason: t }))}
              multiline
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, applyMutation.isPending && { opacity: 0.7 }]}
              onPress={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
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
    backgroundColor: '#fff',
    paddingTop: 52,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4 },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  balCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  balVal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  balLabel: { fontSize: 10, fontWeight: '700', color: '#0f172a', marginTop: 2, textAlign: 'center' },
  balUsed: { fontSize: 9, color: '#94a3b8', marginTop: 1 },
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
  emptyState: { padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 13 },
  leaveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  leaveType: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  leaveDates: { fontSize: 11, color: '#64748b', marginTop: 2 },
  leaveReason: { fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  modalClose: { padding: 4, backgroundColor: '#f1f5f9', borderRadius: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  typePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  dateRow: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
