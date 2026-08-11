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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT: { bg: '#dcfce7', text: '#15803d', label: 'Present' },
  ABSENT: { bg: '#fee2e2', text: '#991b1b', label: 'Absent' },
  LEAVE: { bg: '#dbeafe', text: '#1e40af', label: 'Leave' },
  HALF_DAY: { bg: '#fef9c3', text: '#854d0e', label: 'Half Day' },
  WFH: { bg: '#f3e8ff', text: '#6b21a8', label: 'WFH' },
  LATE: { bg: '#fff7ed', text: '#c2410c', label: 'Late' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { bg: '#f1f5f9', text: '#64748b', label: status };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
}

function geoInfo(s: GeoStatus): { icon: IoniconsName; iconColor: string; bg: string; text: string; pill: string; pillColor: string; pillBg: string } {
  switch (s.type) {
    case 'acquiring': return { icon: 'locate-outline', iconColor: '#94a3b8', bg: '#f8fafc', text: 'Acquiring location…', pill: 'Locating', pillColor: '#64748b', pillBg: '#f1f5f9' };
    case 'inside': return { icon: 'checkmark-circle', iconColor: '#16a34a', bg: '#f0fdf4', text: `Inside — ${s.locationName} (${s.distanceMeters}m)`, pill: 'In Range', pillColor: '#15803d', pillBg: '#dcfce7' };
    case 'outside': return { icon: 'location', iconColor: '#dc2626', bg: '#fef2f2', text: `Too far — ${s.nearestName} (${s.distanceMeters}m away)`, pill: 'Out of Range', pillColor: '#991b1b', pillBg: '#fee2e2' };
    case 'denied': return { icon: 'wifi-outline', iconColor: '#d97706', bg: '#fffbeb', text: 'Location unavailable — punch allowed', pill: 'GPS Off', pillColor: '#92400e', pillBg: '#fef3c7' };
    case 'no_fence': return { icon: 'globe-outline', iconColor: '#64748b', bg: '#f8fafc', text: 'No geo-fence · All punches allowed', pill: 'All locations', pillColor: '#16a34a', pillBg: '#dcfce7' };
    case 'exempt': return { icon: 'shield-checkmark', iconColor: '#2563eb', bg: '#eff6ff', text: 'Geo-fence exempt — punch from anywhere', pill: 'Exempt', pillColor: '#1e40af', pillBg: '#dbeafe' };
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

  const { data: monthlyData, isLoading, isError, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-attendance-month', month],
    queryFn: () => api.get(`/api/attendance/my?month=${month}`).then(r => r.data.data || []),
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
        // Check existing permission first — avoids blocking dialog on every mount
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
  const canPunchIn = !punchedIn && geoStatus.type !== 'outside' && !punchLoading;
  const canPunchOut = punchedIn && !punchedOut && !punchLoading;

  const stats = {
    present: (monthlyData || []).filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length,
    absent: (monthlyData || []).filter((r: any) => r.status === 'ABSENT').length,
    leave: (monthlyData || []).filter((r: any) => r.status === 'LEAVE').length,
    wfh: (monthlyData || []).filter((r: any) => r.status === 'WFH').length,
  };

  const geo = geoInfo(geoStatus);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchToday(); }} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </View>

      {/* Punch Card */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.punchCardHeader}>
          <Text style={styles.punchCardTitle}>Today's Punch</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: geo.pillBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Ionicons name={geo.icon} size={10} color={geo.pillColor} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: geo.pillColor }}>{geo.pill}</Text>
          </View>
        </View>

        <View style={styles.punchTimes}>
          <View style={[styles.punchTimeBox, { borderRightWidth: 1, borderRightColor: '#f8fafc' }]}>
            <Text style={styles.punchTimeLabel}>PUNCH IN</Text>
            <Text style={styles.punchTimeValue}>
              {todayRecord?.punchIn ? new Date(todayRecord.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
          <View style={styles.punchTimeBox}>
            <Text style={styles.punchTimeLabel}>PUNCH OUT</Text>
            <Text style={styles.punchTimeValue}>
              {todayRecord?.punchOut ? new Date(todayRecord.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.punchBtns}>
          <TouchableOpacity
            style={[styles.punchBtn, { backgroundColor: canPunchIn ? '#2563eb' : '#f1f5f9' }]}
            onPress={() => handlePunch('IN')}
            disabled={!canPunchIn}
          >
            {punchLoading && !punchedIn ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name={punchedIn ? 'checkmark-circle' : 'enter-outline'} size={15} color={canPunchIn ? '#fff' : '#94a3b8'} />
                <Text style={[styles.punchBtnText, { color: canPunchIn ? '#fff' : '#94a3b8' }]}>
                  {punchedIn ? 'Punched In' : 'Punch In'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.punchBtn, { backgroundColor: canPunchOut ? '#ef4444' : '#f1f5f9' }]}
            onPress={() => handlePunch('OUT')}
            disabled={!canPunchOut}
          >
            {punchLoading && punchedIn && !punchedOut ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name={punchedOut ? 'checkmark-circle' : 'exit-outline'} size={15} color={canPunchOut ? '#fff' : '#94a3b8'} />
                <Text style={[styles.punchBtnText, { color: canPunchOut ? '#fff' : '#94a3b8' }]}>
                  {punchedOut ? 'Punched Out' : 'Punch Out'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {geoStatus.type === 'outside' && !punchedIn && (
          <View style={styles.outsideWarn}>
            <Ionicons name="warning-outline" size={13} color="#dc2626" />
            <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '600', flex: 1 }}>
              Move closer to the office to punch in
            </Text>
          </View>
        )}
      </View>

      {/* Monthly stats */}
      <Text style={styles.sectionLabel}>THIS MONTH</Text>
      <View style={styles.statsRow}>
        {[
          { label: 'Present', value: stats.present, color: '#22c55e' },
          { label: 'Absent', value: stats.absent, color: '#ef4444' },
          { label: 'Leave', value: stats.leave, color: '#2563eb' },
          { label: 'WFH', value: stats.wfh, color: '#9333ea' },
        ].map(s => (
          <View key={s.label} style={styles.statBox}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Log */}
      <Text style={styles.sectionLabel}>ATTENDANCE LOG</Text>
      {isLoading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
      ) : isError ? (
        <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
          <Ionicons name="cloud-offline-outline" size={32} color="#cbd5e1" />
          <Text style={{ color: '#94a3b8', fontSize: 13 }}>Could not load attendance.</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
            <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          {(monthlyData || []).length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>No attendance records yet.</Text>
            </View>
          ) : (monthlyData || []).slice(0, 15).map((r: any, i: number, arr: any[]) => (
            <View key={r.date} style={[styles.logRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logDate}>
                  {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                {(r.punchIn || r.punchOut) && (
                  <Text style={styles.logTime}>
                    {r.punchIn ? `In ${new Date(r.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    {r.punchIn && r.punchOut ? ' · ' : ''}
                    {r.punchOut ? `Out ${new Date(r.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                )}
              </View>
              <Badge status={r.status} />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
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
  headerDate: { fontSize: 12, color: '#64748b' },
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
  punchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  punchCardTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  punchTimes: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  punchTimeBox: { flex: 1, padding: 14, alignItems: 'center' },
  punchTimeLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.4, marginBottom: 4 },
  punchTimeValue: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  punchBtns: { flexDirection: 'row', gap: 8, padding: 10 },
  punchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 11,
    borderRadius: 9,
  },
  punchBtnText: { fontSize: 12, fontWeight: '700' },
  outsideWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
    padding: 10,
    paddingHorizontal: 12,
  },
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
  statsRow: { flexDirection: 'row', gap: 6, marginHorizontal: 12, marginBottom: 2 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  logDate: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  logTime: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
});
