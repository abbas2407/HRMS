import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import api from '../../lib/api';

export default function ProfileScreen() {
  const logout = useAuthStore(s => s.logout);

  // Fetch self profile details
  const { data: me } = useQuery<any>({
    queryKey: ['my-employee-profile'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  const name = me ? `${me.firstName} ${me.lastName || ''}`.trim() : 'Employee';
  const initials = me ? `${me.firstName?.[0] || ''}${me.lastName?.[0] || ''}`.toUpperCase() : '??';
  const empCode = me?.employeeCode || '—';
  const designation = me?.designation || '—';
  const email = me?.workEmail || me?.personalEmail || '—';
  const phone = me?.phone || '—';
  const dob = me?.dateOfBirth ? new Date(me.dateOfBirth).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : '—';
  const gender = me?.gender ? me.gender.charAt(0).toUpperCase() + me.gender.slice(1).toLowerCase() : '—';
  const dept = me?.department?.name || '—';
  const joiningDate = me?.joiningDate ? new Date(me.joiningDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : '—';
  const empType = me?.employmentType ? me.employmentType.replace('_', ' ') : '—';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/api/auth/logout');
          } catch {
            // ignore
          }
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Blue Profile Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            {/* Name and Badges */}
            <View style={styles.headerInfo}>
              <Text style={styles.nameText}>{name}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{empCode}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{designation}</Text>
                </View>
              </View>
            </View>

            {/* Edit Button */}
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          <View style={styles.card}>
            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>EMAIL</Text>
              <Text style={styles.itemVal}>{email}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>PHONE</Text>
              <Text style={styles.itemVal}>{phone}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>DATE OF BIRTH</Text>
              <Text style={styles.itemVal}>{dob}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>GENDER</Text>
              <Text style={styles.itemVal}>{gender}</Text>
            </View>
          </View>
        </View>

        {/* WORK DETAILS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORK DETAILS</Text>
          <View style={styles.card}>
            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>DEPARTMENT</Text>
              <Text style={styles.itemVal}>{dept}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>DESIGNATION</Text>
              <Text style={styles.itemVal}>{designation}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>JOINING DATE</Text>
              <Text style={styles.itemVal}>{joiningDate}</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.cardItem}>
              <Text style={styles.itemLabel}>EMPLOYMENT TYPE</Text>
              <Text style={styles.itemVal}>{empType}</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  cardItem: {
    paddingVertical: 12,
  },
  itemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  itemVal: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  signOutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
    marginHorizontal: 20,
    marginTop: 28,
    height: 50,
    borderRadius: 14,
  },
  signOutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
