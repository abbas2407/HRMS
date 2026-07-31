import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import {
  IconLogin, IconLogout, IconClock, IconAlertCircle,
  IconMapPin, IconCurrentLocation, IconCircleCheck, IconLoader2,
  IconWifi, IconWifiOff,
} from '@tabler/icons-react';

function formatTime(d: string | Date | null): string {
  if (!d) return '--:--';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(hours: string | null): string {
  if (!hours) return '--';
  const h = parseFloat(hours);
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

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

type GeoStatus =
  | { type: 'acquiring' }
  | { type: 'inside'; locationName: string; distanceMeters: number }
  | { type: 'outside'; nearestName: string; distanceMeters: number }
  | { type: 'denied' }
  | { type: 'no_fence' }
  | { type: 'exempt' };

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#22c55e',
  LATE: '#f59e0b',
  HALF_DAY: '#f97316',
  ABSENT: '#ef4444',
};

export default function PunchPage() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ type: 'acquiring' });
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get('/attendance/today').then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/office-locations').then(r => r.data.data),
  });

  // Check if employee is geo-exempt from their profile
  const isGeoExempt = data?.log?.isGeoExempt ?? false;

  // Compute geo status from live coords + office locations
  useEffect(() => {
    if (isGeoExempt) { setGeoStatus({ type: 'exempt' }); return; }

    const activeLocations = (locations as any[]).filter(l => l.isActive);
    if (!activeLocations.length) { setGeoStatus({ type: 'no_fence' }); return; }

    if (!liveCoords) return; // still acquiring

    let bestInside: { name: string; dist: number } | null = null;
    let nearest: { name: string; dist: number } | null = null;

    for (const loc of activeLocations) {
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

  // Start watching GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus({ type: 'denied' });
      return;
    }

    setGeoStatus({ type: 'acquiring' });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGeoStatus({ type: 'denied' }),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const punchInMutation = useMutation({
    mutationFn: () => {
      setPunchError(null);
      const body = liveCoords ? { lat: liveCoords.lat, lng: liveCoords.lng } : {};
      return api.post('/attendance/punch-in', body).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', 'today'] }),
    onError: (err: any) => {
      if (err?.response?.data?.code === 'GEO_FENCE_VIOLATION') {
        const dist = err.response.data.geoDistanceMeters;
        setPunchError(`You are ${dist ? `${dist}m` : 'too far'} from the office. Move closer and try again.`);
      } else {
        setPunchError(err?.response?.data?.error || 'Something went wrong');
      }
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/punch-out', {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', 'today'] }),
    onError: (err: any) => setPunchError(err?.response?.data?.error || 'Something went wrong'),
  });

  const log = data?.log;
  const shift = data?.shift;

  // Geo status display config
  const geoDisplay: Record<GeoStatus['type'], { icon: React.ReactNode; bg: string; color: string; label: string; sub?: string }> = {
    acquiring: {
      icon: <IconLoader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />,
      bg: '#f8fafc', color: '#64748b', label: 'Acquiring location…', sub: 'Please wait',
    },
    inside: {
      icon: <IconCircleCheck size={15} />,
      bg: '#f0fdf4', color: '#16a34a',
      label: `Inside fence — ${(geoStatus as any).locationName}`,
      sub: `${(geoStatus as any).distanceMeters}m from office`,
    },
    outside: {
      icon: <IconMapPin size={15} />,
      bg: '#fef2f2', color: '#dc2626',
      label: `Outside fence — ${(geoStatus as any).nearestName}`,
      sub: `${(geoStatus as any).distanceMeters}m away (too far)`,
    },
    denied: {
      icon: <IconWifiOff size={15} />,
      bg: '#fffbeb', color: '#d97706', label: 'GPS unavailable', sub: 'Fence not enforced — punch allowed',
    },
    no_fence: {
      icon: <IconWifi size={15} />,
      bg: '#f8fafc', color: '#64748b', label: 'No geo-fence configured', sub: 'All punches allowed',
    },
    exempt: {
      icon: <IconCircleCheck size={15} />,
      bg: '#eff6ff', color: '#2563eb', label: 'Geo-fence exempt', sub: 'You can punch from anywhere',
    },
  };

  const geo = geoDisplay[geoStatus.type];

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>My Attendance</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 24 }}>
        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* Clock */}
      <div style={{ textAlign: 'center', padding: '28px 0 20px', background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', marginBottom: 16 }}>
        <div style={{ fontSize: 50, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -2 }}>
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
        {shift && (
          <div style={{ marginTop: 6, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            <IconClock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {shift.name} · {shift.startTime} – {shift.endTime}
          </div>
        )}
      </div>

      {/* Live geo status */}
      {!log?.punchIn && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: geo.bg, border: `1px solid ${geo.color}33`,
          borderRadius: 10, marginBottom: 16,
        }}>
          <span style={{ color: geo.color, flexShrink: 0 }}>{geo.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: geo.color }}>{geo.label}</div>
            {geo.sub && <div style={{ fontSize: 11, color: geo.color, opacity: 0.8, marginTop: 1 }}>{geo.sub}</div>}
          </div>
          {liveCoords && geoStatus.type !== 'no_fence' && geoStatus.type !== 'exempt' && (
            <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'monospace', textAlign: 'right', flexShrink: 0 }}>
              {liveCoords.lat.toFixed(5)}<br />{liveCoords.lng.toFixed(5)}
            </div>
          )}
        </div>
      )}

      {/* Status card */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 20 }}>Loading…</div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.05em' }}>PUNCH IN</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{formatTime(log?.punchIn)}</div>
              {log?.isLate && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>+{log.lateByMinutes}m late</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.05em' }}>PUNCH OUT</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{formatTime(log?.punchOut)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.05em' }}>HOURS</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{formatDuration(log?.workingHours)}</div>
            </div>
          </div>

          {log?.status && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <span style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: 20,
                background: `${STATUS_COLORS[log.status] ?? '#94a3b8'}22`,
                color: STATUS_COLORS[log.status] ?? '#64748b',
                fontWeight: 700, fontSize: 13,
              }}>
                {log.status.replace('_', ' ')}
              </span>
            </div>
          )}

          {log?.officeLocationId && log?.geoDistanceMeters != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <IconMapPin size={12} />
              Punched in {log.geoDistanceMeters}m from office
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => punchInMutation.mutate()}
          disabled={!!log?.punchIn || punchInMutation.isPending || geoStatus.type === 'outside'}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
            background: !log?.punchIn && geoStatus.type !== 'outside' ? '#22c55e' : 'var(--color-border)',
            color: !log?.punchIn && geoStatus.type !== 'outside' ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 700, fontSize: 15, cursor: !log?.punchIn && geoStatus.type !== 'outside' ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          <IconLogin size={18} />
          {punchInMutation.isPending ? 'Punching in…' : 'Punch In'}
        </button>
        <button
          onClick={() => punchOutMutation.mutate()}
          disabled={!log?.punchIn || !!log?.punchOut || punchOutMutation.isPending}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
            background: log?.punchIn && !log?.punchOut ? '#ef4444' : 'var(--color-border)',
            color: log?.punchIn && !log?.punchOut ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 700, fontSize: 15, cursor: log?.punchIn && !log?.punchOut ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <IconLogout size={18} />
          {punchOutMutation.isPending ? 'Punching out…' : 'Punch Out'}
        </button>
      </div>

      {/* "Re-check location" when outside */}
      {geoStatus.type === 'outside' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
            <IconAlertCircle size={15} />
            Move closer to the office to punch in
          </div>
          <button onClick={() => setLiveCoords(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            <IconCurrentLocation size={13} /> Re-check
          </button>
        </div>
      )}

      {punchError && geoStatus.type !== 'outside' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#b91c1c', fontSize: 13 }}>
          <IconAlertCircle size={15} style={{ flexShrink: 0 }} />
          {punchError}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
