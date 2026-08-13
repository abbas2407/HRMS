import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/lib/api';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type GeoStatus =
  | { type: 'acquiring' }
  | { type: 'inside'; locationName: string; distanceMeters: number }
  | { type: 'outside'; nearestName: string; distanceMeters: number }
  | { type: 'denied' }
  | { type: 'no_fence' }
  | { type: 'exempt' };

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT:  { bg: '#f0fdf4', text: '#16a34a', label: 'PRESENT' },
  ABSENT:   { bg: '#fef2f2', text: '#dc2626', label: 'ABSENT' },
  LEAVE:    { bg: '#eff6ff', text: '#1e40af', label: 'LEAVE' },
  HALF_DAY: { bg: '#fffbeb', text: '#b45309', label: 'HALF DAY' },
  WFH:      { bg: '#faf5ff', text: '#6b21a8', label: 'WFH' },
  LATE:     { bg: '#fffbeb', text: '#b45309', label: 'LATE' },
  WEEKEND:  { bg: '#f8fafc', text: '#94a3b8', label: 'WEEKEND' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { bg: '#f1f5f9', text: '#64748b', label: status.toUpperCase() };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
}

function geoInfo(s: GeoStatus): { icon: IoniconsName; iconColor: string; pillBg: string; pillText: string; pillLabel: string; desc: string } {
  switch (s.type) {
    case 'acquiring': return { icon: 'locate-outline', iconColor: '#94a3b8', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: 'Cyberlink HQ, Mumbai' };
    case 'inside':    return { icon: 'checkmark-circle', iconColor: '#16a34a', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: s.locationName || 'Cyberlink HQ, Mumbai' };
    case 'outside':   return { icon: 'location-outline', iconColor: '#16a34a', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: s.nearestName || 'Cyberlink HQ, Mumbai' };
    case 'denied':    return { icon: 'warning-outline', iconColor: '#16a34a', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: 'Cyberlink HQ, Mumbai' };
    case 'no_fence':  return { icon: 'globe-outline', iconColor: '#16a34a', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: 'Cyberlink HQ, Mumbai' };
    case 'exempt':    return { icon: 'shield-checkmark-outline', iconColor: '#16a34a', pillBg: '#f0fdf4', pillText: '#16a34a', pillLabel: 'In Zone', desc: 'Cyberlink HQ, Mumbai' };
  }
}

const formatRowDate = (dateStr: string) => {
  try {
    const rowDate = new Date(dateStr);
    const today = new Date();
    const isToday = rowDate.toDateString() === today.toDateString();
    const month = rowDate.toLocaleDateString('en-US', { month: 'short' });
    const day = rowDate.getDate();
    const weekday = rowDate.toLocaleDateString('en-US', { weekday: 'short' });
    if (isToday) {
      return `Today, ${month} ${day}`;
    } else {
      return `${month} ${day}, ${weekday}`;
    }
  } catch {
    return dateStr;
  }
};

export default function AttendanceScreen() {
  const qc = useQueryClient();
  const [punchLoading, setPunchLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ type: 'acquiring' });
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  const { data: todayRecord, refetch: refetchToday } = useQuery<any>({
    queryKey: ['my-attendance-today'],
    queryFn: () => api.get(`/api/attendance/my?date=${today}`).then(r => r.data.data?.[0] || null),
  });

  const [yearStr, monthStr] = month.split('-');
  const { data: monthlyData, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-attendance-month', month],
    queryFn: () => api.get(`/api/attendance/my?month=${Number(monthStr)}&year=${Number(yearStr)}`).then(r => r.data.data || []),
    retry: 1,
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/api/office-locations').then(r => r.data.data || []),
  });

  const isGeoExempt = todayRecord?.isGeoExempt ?? false;

  useEffect(() => {
    if (isGeoExempt) { setGeoStatus({ type: 'exempt' }); return; }
    const active = (locations as any[]).filter(l => l.isActive);
    if (!active.length) { setGeoStatus({ type: 'no_fence' }); return; }
    if (!liveCoords) return;
    let bestInside: { name: string; dist: number } | null = null;
    let nearest: { name: string; dist: number } | null = null;
    for (const loc of active) {
      const dist = Math.round(haversineMeters(liveCoords.lat, liveCoords.lng, Number(loc.lat), Number(loc.lng)));
      if (!nearest || dist < nearest.dist) nearest = { name: loc.name, dist };
      if (dist <= (loc.radiusMeters ?? 100)) {
        if (!bestInside || dist < bestInside.dist) bestInside = { name: loc.name, dist };
      }
    }
    if (bestInside) setGeoStatus({ type: 'inside', locationName: bestInside.name, distanceMeters: bestInside.dist });
    else setGeoStatus({ type: 'outside', nearestName: nearest!.name, distanceMeters: nearest!.dist });
  }, [liveCoords, locations, isGeoExempt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status: existing } = await Location.getForegroundPermissionsAsync();
        let granted = existing === 'granted';
        if (!granted && existing === 'undetermined') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          granted = status === 'granted';
        }
        if (!granted) {
          if (!cancelled) setGeoStatus({ type: 'denied' });
          return;
        }
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 10 },
          pos => { if (!cancelled) setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }
        );
        if (cancelled) { sub.remove(); return; }
        watchSub.current = sub;
      } catch {
        if (!cancelled) setGeoStatus({ type: 'denied' });
      }
    })();
    return () => { cancelled = true; watchSub.current?.remove(); };
  }, []);

  async function handlePunch(type: 'IN' | 'OUT') {
    setPunchLoading(true);
    try {
      const body = liveCoords ? { lat: liveCoords.lat, lng: liveCoords.lng } : {};
      if (type === 'IN') await api.post('/api/attendance/punch-in', body);
      else await api.post('/api/attendance/punch-out', body);
      await refetchToday();
      qc.invalidateQueries({ queryKey: ['my-attendance-month'] });
      Alert.alert('Success', `Punched ${type === 'IN' ? 'In' : 'Out'} successfully!`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || `Failed to punch ${type === 'IN' ? 'in' : 'out'}`);
    } finally {
      setPunchLoading(false);
    }
  }

  const punchedIn = !!todayRecord?.punchIn;
  const punchedOut = !!todayRecord?.punchOut;
  const geo = geoInfo(geoStatus);

  const formatTime = (dt: string | null | undefined) => {
    if (!dt) return '--:--';
    try {
      return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return '--:--'; }
  };

  const presentCount = (monthlyData || []).filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Attendance</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Ionicons name="location-outline" size={12} color="#94a3b8" />
              <Text style={styles.headerSub}>{geo.desc}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: geo.pillBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: geo.pillText }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: geo.pillText }}>{geo.pillLabel}</Text>
          </View>
        </View>

        {/* Today card */}
        <Text style={styles.sectionLabel}>TODAY</Text>
        <View style={styles.card}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <Text style={styles.punchLabel}>PUNCH IN</Text>
                <Text style={styles.punchTime}>{formatTime(todayRecord?.punchIn)}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#f1f5f9' }} />
              <View style={{ flex: 1, paddingLeft: 24 }}>
                <Text style={styles.punchLabel}>PUNCH OUT</Text>
                <Text style={[styles.punchTime, { color: punchedOut ? '#0f172a' : '#94a3b8' }]}>
                  {formatTime(todayRecord?.punchOut)}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: punchedIn ? (punchedOut ? '100%' : '58%') : '0%', backgroundColor: '#2563EB', borderRadius: 3 }} />
            </View>

            {punchLoading ? (
              <ActivityIndicator color="#2563EB" />
            ) : !punchedIn ? (
              <TouchableOpacity style={styles.punchBtn} onPress={() => handlePunch('IN')}>
                <Text style={styles.punchBtnText}>Punch In</Text>
              </TouchableOpacity>
            ) : !punchedOut ? (
              <TouchableOpacity style={styles.punchBtn} onPress={() => handlePunch('OUT')}>
                <Text style={styles.punchBtnText}>Punch Out</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.punchBtn, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.punchBtnText, { color: '#16a34a' }]}>Day Complete</Text>
              </View>
            )}
          </View>
        </View>

        {/* Monthly log */}
        <Text style={styles.sectionLabel}>THIS MONTH • {presentCount} PRESENT</Text>
        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
        ) : (
          <View style={[styles.card, { marginBottom: 24 }]}>
            {(monthlyData || []).map((row: any, i: number, arr: any[]) => (
              <View key={row.date || i} style={[styles.cardRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>
                    {formatRowDate(row.date)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    In {formatTime(row.punchIn)} • Out {formatTime(row.punchOut)}
                  </Text>
                </View>
                <Badge status={row.status || 'ABSENT'} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: '#64748b' },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', padding: 13,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  punchLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  punchTime: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  punchBtn: {
    backgroundColor: '#2563EB', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  punchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
