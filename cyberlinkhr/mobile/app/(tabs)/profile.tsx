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

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon: IoniconsName }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={14} color="#94a3b8" style={{ marginRight: 8 }} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: emp, isLoading } = useQuery<any>({
    queryKey: ['my-profile-mobile'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
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
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirm) {
      setPwError('Please fill in all fields'); return;
    }
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

  const fullName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '';
  const initials = fullName
    ? fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  const roleBadge = user?.role?.replace(/_/g, ' ') || 'Employee';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* White header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} />
          ) : (
            <>
              <Text style={styles.name}>{fullName || user?.email?.split('@')[0] || '—'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{roleBadge}</Text>
                </View>
                {emp?.employeeCode ? (
                  <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={[styles.badgeText, { color: '#64748b' }]}>{emp.employeeCode}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.email}>{user?.email}</Text>
            </>
          )}
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
        <View style={styles.card}>
          <InfoRow label="Date of Birth" value={emp?.dob} icon="calendar-outline" />
          <InfoRow label="Gender" value={emp?.gender} icon="person-outline" />
          <InfoRow label="Phone" value={emp?.phone} icon="call-outline" />
          <InfoRow label="Joining Date" value={emp?.joiningDate} icon="enter-outline" />
        </View>

        {/* Work Details */}
        <Text style={styles.sectionLabel}>WORK DETAILS</Text>
        <View style={styles.card}>
          <InfoRow label="Department" value={emp?.departmentName} icon="business-outline" />
          <InfoRow label="Designation" value={emp?.designationName} icon="briefcase-outline" />
          <InfoRow label="Employment Type" value={emp?.employmentType?.replace(/_/g, ' ')} icon="document-text-outline" />
          <InfoRow label="Work Location" value={emp?.workLocation} icon="location-outline" />
          {emp?.grade ? <InfoRow label="Grade" value={emp.grade} icon="ribbon-outline" /> : null}
        </View>

        {/* Security */}
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={() => setPwModal(true)}>
            <View style={styles.actionLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="lock-closed-outline" size={16} color="#2563eb" />
              </View>
              <Text style={styles.actionLabel}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CyberlinkHR v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={pwModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => { setPwModal(false); setPwError(''); }} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            {[
              { label: 'Current Password', key: 'currentPassword', show: showCurrent, toggle: () => setShowCurrent(v => !v) },
              { label: 'New Password', key: 'newPassword', show: showNew, toggle: () => setShowNew(v => !v) },
              { label: 'Confirm New Password', key: 'confirm', show: showConfirm, toggle: () => setShowConfirm(v => !v) },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <View style={styles.pwInputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, padding: 0, backgroundColor: 'transparent' }]}
                    placeholder="••••••••"
                    placeholderTextColor="#cbd5e1"
                    value={(pwForm as any)[f.key]}
                    onChangeText={t => setPwForm(p => ({ ...p, [f.key]: t }))}
                    secureTextEntry={!f.show}
                  />
                  <TouchableOpacity onPress={f.toggle} style={{ padding: 4 }}>
                    <Ionicons name={f.show ? 'eye-off-outline' : 'eye-outline'} size={17} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {pwError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontSize: 12, flex: 1 }}>{pwError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, { opacity: pwMutation.isPending ? 0.6 : 1 }]}
              onPress={handlePwSubmit}
              disabled={pwMutation.isPending}
            >
              {pwMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>Update Password</Text>
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
    backgroundColor: '#fff',
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2563eb', textTransform: 'capitalize' },
  email: { fontSize: 12, color: '#94a3b8' },
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, color: '#0f172a', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  logoutBtn: {
    marginHorizontal: 12,
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 16 },
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
  closeBtn: { padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pwInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 13,
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
    marginBottom: 10,
  },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
