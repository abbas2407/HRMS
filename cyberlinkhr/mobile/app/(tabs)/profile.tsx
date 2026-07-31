import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const { data: emp, isLoading } = useQuery<any>({
    queryKey: ['my-profile-mobile'],
    queryFn: () => api.get(`/api/employees/${user?.userId}`).then(r => r.data.data),
    enabled: !!user?.userId,
  });

  const pwMutation = useMutation({
    mutationFn: () => api.post('/api/auth/change-password', {
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    }).then(r => r.data),
    onSuccess: () => {
      setPwModal(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setPwError('');
      Alert.alert('Success', 'Password changed successfully.');
    },
    onError: (e: any) => setPwError(e?.response?.data?.error || 'Failed to change password'),
  });

  function handlePwSubmit() {
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    pwMutation.mutate();
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('/api/auth/logout'); } catch {}
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const initials = emp ? `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}` : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {isLoading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={styles.name}>{emp?.firstName} {emp?.lastName}</Text>
              <Text style={styles.role}>{user?.role?.replace('_', ' ')} · {emp?.employeeCode}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </>
          )}
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <InfoRow label="Date of Birth" value={emp?.dob} />
          <InfoRow label="Gender" value={emp?.gender} />
          <InfoRow label="Phone" value={emp?.phone} />
          <InfoRow label="Joining Date" value={emp?.joiningDate} />
          <InfoRow label="Department" value={emp?.departmentName} />
          <InfoRow label="Designation" value={emp?.designationName} />
          <InfoRow label="Employment Type" value={emp?.employmentType?.replace('_', ' ')} />
          <InfoRow label="Work Location" value={emp?.workLocation} />
        </View>

        {/* Security */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => setPwModal(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed-outline" size={16} color="#0f172a" />
              <Text style={styles.actionLabel}>Change Password</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CyberlinkHR v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Password modal */}
      <Modal visible={pwModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => { setPwModal(false); setPwError(''); }}>
              <Text style={{ fontSize: 22, color: '#94a3b8' }}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            {[
              { label: 'Current Password', key: 'currentPassword', placeholder: '••••••••' },
              { label: 'New Password', key: 'newPassword', placeholder: 'Min. 8 characters' },
              { label: 'Confirm New Password', key: 'confirm', placeholder: '••••••••' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  value={(pwForm as any)[f.key]}
                  onChangeText={t => setPwForm(p => ({ ...p, [f.key]: t }))}
                  secureTextEntry
                />
              </View>
            ))}
            {pwError ? <Text style={{ color: '#ef4444', marginBottom: 12 }}>{pwError}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: pwMutation.isPending ? 0.6 : 1 }]}
              onPress={handlePwSubmit}
              disabled={pwMutation.isPending}
            >
              <Text style={styles.submitBtnText}>
                {pwMutation.isPending ? 'Saving...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#2563EB',
    padding: 24,
    paddingTop: 56,
    alignItems: 'center',
    paddingBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 3 },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 2 },
  email: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, padding: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, color: '#0f172a', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  actionLabel: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  actionChevron: { fontSize: 20, color: '#94a3b8' },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 13, fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
