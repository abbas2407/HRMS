import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/stores/auth.store';
import api from '@/src/lib/api';

export default function LoginScreen() {
  const login = useAuthStore(s => s.login);
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!slug.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', {
        email: email.trim(),
        password,
        slug: slug.toLowerCase().trim(),
      });
      const { user, accessToken, refreshToken, tenant } = data.data;
      await login(
        { ...user, slug: tenant.slug, companyName: tenant.name },
        accessToken,
        refreshToken,
      );
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid credentials. Check your Company ID, email and password.';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBox}>
          <Ionicons name="people-outline" size={30} color="#fff" />
        </View>
        <Text style={styles.appName}>CyberlinkHR</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.card}>
          {/* Company ID */}
          <View style={styles.field}>
            <Text style={styles.label}>COMPANY ID</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="home-outline" size={16} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={slug}
                onChangeText={setSlug}
                placeholder="cyberlink-001"
                placeholderTextColor="#cbd5e1"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={16} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="abbas@cyberlink.co.in"
                placeholderTextColor="#cbd5e1"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Powered by Cyberlink Technologies</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
  },
  appName: { color: '#0f172a', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { color: '#64748b', fontSize: 13, marginBottom: 28 },
  card: {
    backgroundColor: '#ffffff',
    width: '100%', maxWidth: 400,
  },
  field: { marginBottom: 14 },
  label: {
    fontSize: 10, fontWeight: '700', color: '#64748b',
    letterSpacing: 0.5, marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, backgroundColor: '#f8fafc', paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  eyeBtn: { padding: 4, marginLeft: 4 },
  btn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { color: '#94a3b8', fontSize: 11, marginTop: 28 },
});
