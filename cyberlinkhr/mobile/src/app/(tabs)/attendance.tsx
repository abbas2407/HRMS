import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

type GeoStatus =
  | { type: 'acquiring' }
  | { type: 'denied' }
  | { type: 'ready'; inside: boolean; nearestName: string; distMeters: number };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatPunchTime(val: any): string {
  if (!val) return '--:--';
  try {
    let d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    d = new Date(`2000-01-01T${val}`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return String(val);
  } catch {
    return '--:--';
  }
}

function formatPunchDate(val: any): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return String(val);
  } catch {
    return '';
  }
}

const formatDateLabel = (dateStr: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return 'Today, ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const d = new Date(dateStr);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
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
  const [yearStr, monthStr] = today.slice(0, 7).split('-');

  // Query today's punch log
  const { data: todayRecord, refetch: refetchToday } = useQuery<any>({
    queryKey: ['my-attendance-today'],
    queryFn: () =>
      api
        .get('/api/attendance/today')
        .then(r => r.data.data?.log || r.data.data || null)
        .catch(() =>
          api.get(`/api/attendance/my?date=${today}`).then(r => r.data.data?.[0] || null)
        ),
  });

  // Query monthly logs
  const { data: monthlyData, isLoading: loadingLogs, refetch: refetchMonth } = useQuery<any[]>({
    queryKey: ['my-attendance-month'],
    queryFn: () => api.get(`/api/attendance/my?month=${Number(monthStr)}&year=${Number(yearStr)}`).then(r => r.data.data || []),
  });

  // Query office locations
  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/api/office-locations').then(r => r.data.data || []),
  });

  const isGeoExempt = todayRecord?.isGeoExempt ?? false;

  const fetchFastLocation = async () => {
    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      let granted = existing === 'granted';
      if (!granted && existing === 'undetermined') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === 'granted';
      }
      if (!granted) {
        setGeoStatus({ type: 'denied' });
        return;
      }

      // Fast check via last known position first
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setLiveCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
      }

      // Fetch current position with balanced accuracy for fast response
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (current) {
        setLiveCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
      }
    } catch {
      // Fallback to ready if location hardware is slow
      if (!locations || locations.length === 0) {
        setGeoStatus({ type: 'ready', inside: true, nearestName: 'Office', distMeters: 0 });
      }
    }
  };

  // Track location and compute geofence inside/outside status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchFastLocation();

      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          pos => {
            if (cancelled) return;
            setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        );
        watchSub.current = sub;
      } catch {
        // Non-blocking
      }
    })();

    return () => {
      cancelled = true;
      watchSub.current?.remove();
    };
  }, []);

  // Compute geofence state whenever location coords or office locations list changes
  useEffect(() => {
    if (!locations || locations.length === 0) {
      setGeoStatus({ type: 'ready', inside: true, nearestName: 'Office Zone', distMeters: 0 });
      return;
    }

    if (!liveCoords) return;

    let nearest: { name: string; dist: number } | null = null;
    let bestInside: { name: string; dist: number } | null = null;

    for (const loc of locations) {
      const dist = Math.round(haversineMeters(liveCoords.lat, liveCoords.lng, Number(loc.lat), Number(loc.lng)));
      if (!nearest || dist < nearest.dist) nearest = { name: loc.name, dist };
      if (dist <= (loc.radiusMeters ?? 100)) {
        if (!bestInside || dist < bestInside.dist) bestInside = { name: loc.name, dist };
      }
    }

    if (bestInside) {
      setGeoStatus({ type: 'ready', inside: true, nearestName: bestInside.name, distMeters: bestInside.dist });
    } else if (nearest) {
      setGeoStatus({ type: 'ready', inside: false, nearestName: nearest.name, distMeters: nearest.dist });
    }
  }, [liveCoords, locations]);

  const isPunchIn = !todayRecord?.punchIn;

  const handlePunch = async () => {
    const isInside = geoStatus.type === 'ready' && geoStatus.inside;
    if (!isInside && !isGeoExempt) {
      const distText = geoStatus.type === 'ready' ? `You are ${geoStatus.distMeters}m away from ${geoStatus.nearestName}.` : 'Acquiring GPS location...';
      Alert.alert('Geofence Violation', `You must be in the office zone to punch. ${distText}`);
      return;
    }

    setPunchLoading(true);
    try {
      const params = liveCoords ? { lat: liveCoords.lat, lng: liveCoords.lng } : {};
      const endpoint = isPunchIn ? '/api/attendance/punch-in' : '/api/attendance/punch-out';
      let res;
      try {
        res = await api.post(endpoint, params);
      } catch (e) {
        // Fallback for mock server route
        res = await api.post('/api/attendance/punch', { ...params, type: isPunchIn ? 'IN' : 'OUT' });
      }
      Alert.alert('Success', res.data.message || (isPunchIn ? 'Punched in successfully' : 'Punched out successfully'));
      await Promise.all([refetchToday(), refetchMonth()]);
      qc.invalidateQueries({ queryKey: ['attendance-home'] });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to register punch');
    } finally {
      setPunchLoading(false);
    }
  };
  const presentCount = (monthlyData || []).filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Attendance</Text>
          <View style={styles.subtitleWrap}>
            <Ionicons name="location-outline" size={14} color="#64748b" style={{ marginRight: 3 }} />
            <Text style={styles.headerSubtitle}>
              {geoStatus.type === 'ready' ? geoStatus.nearestName : 'Locating office...'}
            </Text>
          </View>
        </View>

        {/* In Zone Badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                geoStatus.type === 'ready' && geoStatus.inside ? '#f0fdf4' : '#fef2f2',
            },
          ]}
        >
          <View
            style={[
              styles.badgeDot,
              {
                backgroundColor:
                  geoStatus.type === 'ready' && geoStatus.inside ? '#22c55e' : '#ef4444',
              },
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              { color: geoStatus.type === 'ready' && geoStatus.inside ? '#15803d' : '#b91c1c' },
            ]}
          >
            {geoStatus.type === 'ready' && geoStatus.inside ? 'In Zone' : 'Out of Zone'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TODAY Section */}
        <Text style={styles.sectionTitle}>TODAY</Text>
        <View style={styles.punchCard}>
          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>PUNCH IN</Text>
              <Text style={[styles.columnTime, !todayRecord?.punchIn && styles.timePlaceholder]}>
                {formatPunchTime(todayRecord?.punchIn)}
              </Text>
            </View>

            <View style={styles.columnDivider} />

            <View style={styles.column}>
              <Text style={styles.columnLabel}>PUNCH OUT</Text>
              <Text style={[styles.columnTime, !todayRecord?.punchOut && styles.timePlaceholder]}>
                {formatPunchTime(todayRecord?.punchOut)}
              </Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          <TouchableOpacity
            style={[
              styles.punchBtn,
              !isPunchIn && { backgroundColor: '#2563eb' },
              punchLoading && { opacity: 0.8 },
            ]}
            onPress={handlePunch}
            disabled={punchLoading}
            activeOpacity={0.85}
          >
            {punchLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.punchBtnText}>{isPunchIn ? 'Punch In' : 'Punch Out'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Monthly Logs */}
        <Text style={styles.sectionTitle}>
          THIS MONTH • {presentCount} PRESENT
        </Text>

        <View style={styles.logsCard}>
          {loadingLogs ? (
            <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} />
          ) : monthlyData && monthlyData.length > 0 ? (
            monthlyData.map((log, idx) => {
              let badgeColor = '#94a3b8';
              let badgeBg = '#f1f5f9';
              if (log.status === 'PRESENT') {
                badgeColor = '#15803d';
                badgeBg = '#f0fdf4';
              } else if (log.status === 'LATE') {
                badgeColor = '#c2410c';
                badgeBg = '#fff7ed';
              } else if (log.status === 'WEEKEND') {
                badgeColor = '#64748b';
                badgeBg = '#f8fafc';
              }

              const inTime = formatPunchTime(log.punchIn);
              const outTime = formatPunchTime(log.punchOut);

              return (
                <View key={log.id}>
                  {idx > 0 && <View style={styles.horizontalDivider} />}
                  <View style={styles.logRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logDate}>{formatDateLabel(log.date)}</Text>
                      <Text style={styles.logTimes}>
                        In {inTime} • Out {outTime}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                        {log.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No attendance logs registered this month.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  punchCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 20,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  columnTime: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  timePlaceholder: {
    color: '#94a3b8',
  },
  columnDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#f1f5f9',
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  punchBtn: {
    backgroundColor: '#2563eb',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  punchBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  logsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  logDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  logTimes: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
