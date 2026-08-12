import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, RefreshControl, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/lib/api';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: '#f0fdf4', text: '#16a34a' },
  PENDING:  { bg: '#fffbeb', text: '#b45309' },
  REJECTED: { bg: '#fef2f2', text: '#dc2626' },
  CANCELLED:{ bg: '#f8fafc', text: '#94a3b8' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.CANCELLED;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ color: s.text, fontSize: 9, fontWeight: '800' }}>{status}</Text>
    </View>
  );
}

export default function LeaveScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const { data: types } = useQuery<any[]>({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/api/leave/types').then(r => r.data.data || []),
  });

  const { data: requests, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/api/leave/requests').then(r => r.data.data || []),
  });

  const { data: balance } = useQuery<any[]>({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/api/leave/balance').then(r => r.data.data || []),
  });

  const applyMutation = useMutation({
    mutationFn: (body: any) => api.post('/api/leave/requests', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowModal(false);
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to apply leave'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/leave/requests/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
  });

  async function handleApply() {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      setError('Please fill all required fields');
      return;
    }
    setError('');
    applyMutation.mutate(form);
  }

  const CHIP_COLORS = ['#2563EB', '#22c55e', '#9333ea', '#f59e0b', '#ea580c'];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leave</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Balance chips */}
        <Text style={styles.sectionLabel}>LEAVE BALANCE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {(balance || []).map((b: any, i: number) => {
            const rem = Number(b.remaining ?? b.balance ?? 0);
            const tot = Number(b.total ?? b.entitled ?? rem);
            const pct = tot > 0 ? Math.round((rem / tot) * 100) : 0;
            const clr = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <View key={b.id || i} style={styles.chip}>
                <Text style={styles.chipLabel}>{b.leaveTypeName || b.name || 'Leave'}</Text>
                <Text style={[styles.chipValue, { color: clr }]}>{rem}</Text>
                <Text style={styles.chipSub}>{tot - rem} used / {tot} total</Text>
                <View style={{ height: 3, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                  <View style={{ height: '100%', width: `${pct}%`, backgroundColor: clr, borderRadius: 2 }} />
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Recent requests */}
        <Text style={styles.sectionLabel}>RECENT REQUESTS</Text>
        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
        ) : (requests || []).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No leave requests yet</Text>
          </View>
        ) : (
          <View style={[styles.card, { marginBottom: 24 }]}>
            {(requests || []).map((req: any, i: number, arr: any[]) => (
              <View key={req.id || i} style={[styles.cardRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar-outline" size={16} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{req.leaveTypeName || req.type || 'Leave'}</Text>
                  <Text style={styles.rowSub}>
                    {req.startDate} — {req.endDate} · {req.days ?? req.daysCount ?? '?'} day(s)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge status={req.status} />
                  {req.status === 'PENDING' && (
                    <TouchableOpacity onPress={() => {
                      Alert.alert('Cancel Leave', 'Cancel this request?', [
                        { text: 'No', style: 'cancel' },
                        { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(req.id) },
                      ]);
                    }}>
                      <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
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

          <ScrollView style={{ padding: 20 }}>
            {/* Leave Type */}
            <Text style={styles.fieldLabel}>Leave Type *</Text>
            <View style={styles.picker}>
              {(types || []).map((t: any) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, form.leaveTypeId === t.id && styles.typeChipActive]}
                  onPress={() => setForm(p => ({ ...p, leaveTypeId: t.id }))}
                >
                  <Text style={[styles.typeChipText, form.leaveTypeId === t.id && { color: '#fff' }]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Start Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.startDate}
              onChangeText={t => setForm(p => ({ ...p, startDate: t }))}
              placeholder="2026-08-15"
              placeholderTextColor="#cbd5e1"
            />

            <Text style={styles.fieldLabel}>End Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.endDate}
              onChangeText={t => setForm(p => ({ ...p, endDate: t }))}
              placeholder="2026-08-15"
              placeholderTextColor="#cbd5e1"
            />

            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.reason}
              onChangeText={t => setForm(p => ({ ...p, reason: t }))}
              placeholder="Optional reason..."
              placeholderTextColor="#cbd5e1"
              multiline
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { opacity: applyMutation.isPending ? 0.6 : 1 }]}
              onPress={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>Submit Request</Text>
              }
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
    backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  applyBtn: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  chip: {
    width: 120, backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1, marginBottom: 12,
  },
  chipLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  chipValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 24 },
  chipSub: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12,
    borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  rowSub: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingTop: Platform.OS === 'ios' ? 16 : 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalClose: { padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#f8fafc',
    padding: 12, fontSize: 14, color: '#0f172a', marginBottom: 16,
  },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  typeChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  errorBox: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 14 },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
