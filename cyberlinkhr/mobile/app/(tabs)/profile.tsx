import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as LocalAuth from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/stores/auth.store';
import api from '@/src/lib/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cardRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function SecurityRow({ icon, iconBg, iconColor, title, sub, onPress, right }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string; iconColor: string;
  title: string; sub: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.cardRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={16} color="#e2e8f0" /> : null)}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore(s => ({ user: s.user, logout: s.logout }));
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [biometric, setBiometric] = useState(false);

  const { data: me, isLoading } = useQuery<any>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  const name = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || user?.email || 'Employee';
  const initials = `${(me?.firstName || '?')[0]}${(me?.lastName || '')[0] || ''}`.toUpperCase();
  const empCode = me?.employeeCode || me?.code || 'EMP';
  const designation = me?.designation?.name || me?.designationName || 'Employee';

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          try { await api.post('/api/auth/logout'); } catch { }
          await logout();
          router.replace('/(auth)/login');
        }
      },
    ]);
  }

  async function handleChangePassword() {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError('Please fill all fields'); return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('New passwords do not match'); return;
    }
    if (pwForm.newPw.length < 6) {
      setPwError('New password must be at least 6 characters'); return;
    }
    setPwError('');
    setPwLoading(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwModal(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
      Alert.alert('Success', 'Password changed successfully!');
    } catch (e: any) {
      setPwError(e?.response?.data?.error || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleBiometricToggle(val: boolean) {
    if (val) {
      try {
        const supported = await LocalAuth.hasHardwareAsync();
        if (!supported) { Alert.alert('Not supported', 'Biometric hardware not available on this device'); return; }
        const enrolled = await LocalAuth.isEnrolledAsync();
        if (!enrolled) { Alert.alert('Not enrolled', 'Please set up fingerprint or Face ID in device settings first'); return; }
        const result = await LocalAuth.authenticateAsync({ promptMessage: 'Enable biometric login', cancelLabel: 'Cancel' });
        if (result.success) setBiometric(true);
      } catch { }
    } else {
      setBiometric(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Blue gradient header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{empCode}</Text></View>
              <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{designation}</Text></View>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
        <View style={styles.card}>
          <InfoRow label="Email" value={me?.email || user?.email || ''} />
          <InfoRow label="Phone" value={me?.phone || me?.phoneNumber || ''} />
          <InfoRow label="Date of Birth" value={me?.dob ? new Date(me.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
          <InfoRow label="Gender" value={me?.gender || ''} />
        </View>

        {/* Work Details */}
        <Text style={styles.sectionLabel}>WORK DETAILS</Text>
        <View style={styles.card}>
          <InfoRow label="Department" value={me?.departmentName || me?.department?.name || ''} />
          <InfoRow label="Designation" value={designation} />
          <InfoRow label="Joining Date" value={me?.joiningDate ? new Date(me.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
          <InfoRow label="Employment Type" value={me?.employmentType || ''} />
          <InfoRow label="Work Location" value={me?.workLocation || ''} />
        </View>

        {/* Security */}
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.card}>
          <SecurityRow
            icon="lock-closed-outline" iconBg="#eff6ff" iconColor="#2563EB"
            title="Change Password" sub="Update your login credentials"
            onPress={() => setPwModal(true)}
          />
          <SecurityRow
            icon="shield-checkmark-outline" iconBg="#f0fdf4" iconColor="#16a34a"
            title="Biometric Login" sub="Fingerprint / Face ID"
            right={
              <Switch
                value={biometric}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#e2e8f0', true: '#22c55e' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Sign out */}
        <View style={{ padding: 14, paddingBottom: 32 }}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={pwModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => { setPwModal(false); setPwError(''); }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={() => { setPwModal(false); setPwError(''); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            {/* Current password */}
            <Text style={styles.pwLabel}>Current Password</Text>
            <View style={styles.pwWrap}>
              <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.pwInput}
                value={pwForm.current}
                onChangeText={t => setPwForm(p => ({ ...p, current: t }))}
                placeholder="Enter current password"
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showCur}
              />
              <TouchableOpacity onPress={() => setShowCur(v => !v)} style={{ padding: 4 }}>
                <Ionicons name={showCur ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* New password */}
            <Text style={styles.pwLabel}>New Password</Text>
            <View style={styles.pwWrap}>
              <Ionicons name="lock-open-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.pwInput}
                value={pwForm.newPw}
                onChangeText={t => setPwForm(p => ({ ...p, newPw: t }))}
                placeholder="Min 6 characters"
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showNew}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={{ padding: 4 }}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Confirm */}
            <Text style={styles.pwLabel}>Confirm New Password</Text>
            <View style={styles.pwWrap}>
              <Ionicons name="lock-open-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.pwInput}
                value={pwForm.confirm}
                onChangeText={t => setPwForm(p => ({ ...p, confirm: t }))}
                placeholder="Repeat new password"
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showConf}
              />
              <TouchableOpacity onPress={() => setShowConf(v => !v)} style={{ padding: 4 }}>
                <Ionicons name={showConf ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {!!pwError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontSize: 12, flex: 1 }}>{pwError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { opacity: pwLoading ? 0.6 : 1 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading
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
  profileHeader: {
    background: undefined,
    backgroundColor: '#1d4ed8',
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatarBox: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileName: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  headerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12,
    borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  rowSub: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2',
    borderRadius: 12, padding: 14,
  },
  signOutText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  pwLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  pwWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#f8fafc', paddingHorizontal: 12, marginBottom: 16 },
  pwInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  errorBox: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 14 },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
