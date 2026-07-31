import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';

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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PRESENT: { bg: '#dcfce7', text: '#15803d', label: 'Present' },
    ABSENT: { bg: '#fee2e2', text: '#991b1b', label: 'Absent' },
    LEAVE: { bg: '#dbeafe', text: '#1e40af', label: 'On Leave' },
    HALF_DAY: { bg: '#fef9c3', text: '#854d0e', label: 'Half Day' },
    WFH: { bg: '#ede9fe', text: '#6b21a8', label: 'WFH' },
  };
  const s = map[status] || { bg: '#f1f5f9', text: '#64748b', label: status };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ color: s.text, fontSize: 12, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
}

const GEO_CONFIG: Record<GeoStatus['type'], { icon: IoniconsName; bg: string; color: string }> = {
  acquiring: { icon: 'locate-outline', bg: '#f8fafc', color: '#64748b' },
  inside: { icon: 'checkmark-circle', bg: '#f0fdf4', color: '#16a34a' },
  outside: { icon: 'location', bg: '#fef2f2', color: '#dc2626' },
  denied: { icon: 'wifi', bg: '#fffbeb', color: '#d97706' },
  no_fence: { icon: 'globe-outline', bg: '#f8fafc', color: '#64748b' },
  exempt: { icon: 'shield-checkmark', bg: '#eff6ff', color: '#2563eb' },
};

function geoLabel(s: GeoStatus): { primary: string; secondary: string } {
  switch (s.type) {
    case 'acquiring': return { primary: 'Acquiring location…', secondary: 'Please wait' };
    case 'inside': return { primary: `Inside fence — ${s.locationName}`, secondary: `${s.distanceMeters}m from office` };
    case 'outside': return { primary: `Outside fence — ${s.nearestName}`, secondary: `${s.distanceMeters}m away (too far)` };
    case 'denied': return { primary: 'GPS unavailable', secondary: 'Fence not enforced — punch allowed' };
    case 'no_fence': return { primary: 'No geo-fence configured', secondary: 'All punches allowed' };
    case 'exempt': return { primary: 'Geo-fence exempt', secondary: 'You can punch from anywhere' };
  }
}

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

  const { data: monthlyData, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-attendance-month', month],
    queryFn: () => api.get(`/api/attendance/my?month=${month}`).then(r => r.data.data),
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/api/office-locations').then(r => r.data.data),
  });

  const isGeoExempt = todayRecord?.isGeoExempt ?? false;

  // Recompute geo status whenever coords or locations change
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
    if (bestInside) {
      setGeoStatus({ type: 'inside', locationName: bestInside.name, distanceMeters: bestInside.dist });
    } else {
      setGeoStatus({ type: 'outside', nearestName: nearest!.name, distanceMeters: nearest!.dist });
    }
  }, [liveCoords, locations, isGeoExempt]);

  // Start location watch on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setGeoStatus({ type: 'denied' });
        return;
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        pos => {
          if (!cancelled) setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      );
      if (cancelled) { sub.remove(); return; }
      watchSub.current = sub;
    })();
    return () => {
      cancelled = true;
      watchSub.current?.remove();
    };
  }, []);

  async function handlePunch(type: 'IN' | 'OUT') {
    setPunchLoading(true);
    try {
      const body = liveCoords ? { lat: liveCoords.lat, lng: liveCoords.lng } : {};
      if (type === 'IN') {
        await api.post('/api/attendance/punch-in', body);
      } else {
        await api.post('/api/attendance/punch-out', body);
      }
      await refetchToday();
      qc.invalidateQueries({ queryKey: ['my-attendance-month'] });
      Alert.alert('Success', `Punched ${type === 'IN' ? 'In' : 'Out'} successfully!`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || `Failed to punch ${type === 'IN' ? 'in' : 'out'}`;
      Alert.alert('Error', msg);
    } finally {
      setPunchLoading(false);
    }
  }

  const punchedIn = !!todayRecord?.punchIn;
  const punchedOut = !!todayRecord?.punchOut;
  const canPunchIn = !punchedIn && geoStatus.type !== 'outside' && !punchLoading;
  const canPunchOut = punchedIn && !punchedOut && !punchLoading;

  const stats = {
    present: (monthlyData || []).filter((r: any) => r.status === 'PRESENT').length,
    absent: (monthlyData || []).filter((r: any) => r.status === 'ABSENT').length,
    leave: (monthlyData || []).filter((r: any) => r.status === 'LEAVE').length,
    wfh: (monthlyData || []).filter((r: any) => r.status === 'WFH').length,
  };

  const geo = GEO_CONFIG[geoStatus.type];
  const geoText = geoLabel(geoStatus);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchToday(); }} tintColor="#2563EB" />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </View>

      {/* Geo-fence status banner */}
      {!punchedIn && (
        <View style={[styles.geoBanner, { backgroundColor: geo.bg, borderColor: geo.color + '44' }]}>
          <Ionicons name={geo.icon} size={18} color={geo.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.geoPrimary, { color: geo.color }]}>{geoText.primary}</Text>
            <Text style={[styles.geoSecondary, { color: geo.color }]}>{geoText.secondary}</Text>
          </View>
        </View>
      )}

      {/* Punch card */}
      <View style={styles.punchCard}>
        <Text style={styles.punchTitle}>Today's Punch</Text>
        <View style={styles.punchTimes}>
          <View style={styles.punchTimeBox}>
            <Text style={styles.punchTimeLabel}>Punch In</Text>
            <Text style={styles.punchTimeValue}>
              {todayRecord?.punchIn ? new Date(todayRecord.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
          <View style={[styles.punchTimeBox, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' }]}>
            <Text style={styles.punchTimeLabel}>Punch Out</Text>
            <Text style={styles.punchTimeValue}>
              {todayRecord?.punchOut ? new Date(todayRecord.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.punchBtns}>
          <TouchableOpacity
            style={[styles.punchBtn, { backgroundColor: canPunchIn ? '#22c55e' : '#e2e8f0' }]}
            onPress={() => handlePunch('IN')}
            disabled={!canPunchIn}
          >
            {punchLoading && !punchedIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={punchedIn ? 'checkmark-circle' : 'log-in-outline'} size={18} color={canPunchIn ? '#fff' : '#94a3b8'} />
                <Text style={[styles.punchBtnText, { color: canPunchIn ? '#fff' : '#94a3b8' }]}>
                  {punchedIn ? 'Punched In' : 'Punch In'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.punchBtn, { backgroundColor: canPunchOut ? '#ef4444' : '#e2e8f0' }]}
            onPress={() => handlePunch('OUT')}
            disabled={!canPunchOut}
          >
            {punchLoading && punchedIn && !punchedOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={punchedOut ? 'checkmark-circle' : 'log-out-outline'} size={18} color={canPunchOut ? '#fff' : '#94a3b8'} />
                <Text style={[styles.punchBtnText, { color: canPunchOut ? '#fff' : '#94a3b8' }]}>
                  {punchedOut ? 'Punched Out' : 'Punch Out'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {geoStatus.type === 'outside' && !punchedIn && (
          <View style={styles.outsideBanner}>
            <Ionicons name="warning-outline" size={14} color="#dc2626" />
            <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600', flex: 1 }}>
              Move closer to the office to punch in
            </Text>
          </View>
        )}
      </View>

      {/* Monthly stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Present', value: stats.present, color: '#22c55e' },
            { label: 'Absent', value: stats.absent, color: '#ef4444' },
            { label: 'Leave', value: stats.leave, color: '#3b82f6' },
            { label: 'WFH', value: stats.wfh, color: '#a855f7' },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Attendance log */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendance Log</Text>
        {isLoading ? (
          <ActivityIndicator color="#2563EB" />
        ) : (monthlyData || []).slice(0, 20).map((r: any) => (
          <View key={r.date} style={styles.logRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logDate}>
                {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              {r.punchIn && (
                <Text style={styles.logTime}>
                  In: {new Date(r.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {r.punchOut ? ` · Out: ${new Date(r.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              )}
            </View>
            <StatusBadge status={r.status} />
          </View>
        ))}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
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
  headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  geoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  geoPrimary: { fontSize: 13, fontWeight: '600' },
  geoSecondary: { fontSize: 11, opacity: 0.8, marginTop: 2 },
  outsideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
    padding: 10,
    paddingHorizontal: 16,
  },
  punchCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  punchTitle: { fontSize: 15, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  punchTimes: { flexDirection: 'row' },
  punchTimeBox: { flex: 1, padding: 16, alignItems: 'center' },
  punchTimeLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  punchTimeValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  punchBtns: { flexDirection: 'row', gap: 10, padding: 16 },
  punchBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchBtnText: { fontSize: 15, fontWeight: '700' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logDate: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  logTime: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
