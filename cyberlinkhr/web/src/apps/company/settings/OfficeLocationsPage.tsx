import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import {
  IconPlus, IconEdit, IconTrash, IconMapPin, IconExternalLink,
  IconCircleCheck, IconCircleX, IconCurrentLocation,
} from '@tabler/icons-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icon (Vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const locationSchema = z.object({
  name: z.string().min(1, 'Name required'),
  address: z.string().optional(),
  lat: z.number({ invalid_type_error: 'Enter a number' }).min(-90).max(90),
  lng: z.number({ invalid_type_error: 'Enter a number' }).min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
  isActive: z.boolean().default(true),
});
type LocationForm = z.infer<typeof locationSchema>;

function gmapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16`;
}

function osmEmbedUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003},${lat - 0.002},${lng + 0.003},${lat + 0.002}&layer=mapnik&marker=${lat},${lng}`;
}

// ── Interactive Leaflet map (click + drag pin) ──────────────────────────────
interface DraggableMapProps {
  lat: number;
  lng: number;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}

function DraggableMap({ lat, lng, radius, onChange }: DraggableMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const updatePos = useCallback((newLat: number, newLng: number) => {
    const roundedLat = parseFloat(newLat.toFixed(7));
    const roundedLng = parseFloat(newLng.toFixed(7));
    onChange(roundedLat, roundedLng);
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.bindTooltip('Drag to adjust pin', { permanent: false, direction: 'top' });
    marker.on('dragend', (e) => {
      const { lat: newLat, lng: newLng } = (e.target as L.Marker).getLatLng();
      updatePos(newLat, newLng);
    });

    const circle = L.circle([lat, lng], {
      radius,
      color: '#2563EB',
      fillColor: '#2563EB',
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: newLat, lng: newLng } = e.latlng;
      marker.setLatLng([newLat, newLng]);
      circle.setLatLng([newLat, newLng]);
      updatePos(newLat, newLng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep marker/circle in sync when lat/lng/radius change externally (from input fields)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 0.0000001 || Math.abs(current.lng - lng) > 0.0000001) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true });
    }
    circleRef.current.setRadius(radius);
  }, [lat, lng, radius]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }} />
      <div style={{
        position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,0.9)',
        borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#374151',
        pointerEvents: 'none', backdropFilter: 'blur(4px)',
      }}>
        Click map to move pin • Drag pin to fine-tune
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
export default function OfficeLocationsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/office-locations').then(r => r.data.data),
  });

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    defaultValues: { lat: 20.5937, lng: 78.9629, radiusMeters: 100, isActive: true },
  });

  const watchLat = watch('lat');
  const watchLng = watch('lng');
  const watchRadius = watch('radiusMeters');
  const hasValidCoords = watchLat >= -90 && watchLat <= 90 && watchLng >= -180 && watchLng <= 180
    && !isNaN(watchLat) && !isNaN(watchLng);

  const saveMutation = useMutation({
    mutationFn: (body: LocationForm) =>
      editing
        ? api.put(`/office-locations/${editing.id}`, body)
        : api.post('/office-locations', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['office-locations'] }); closeModal(); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/office-locations/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['office-locations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/office-locations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['office-locations'] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ lat: 20.5937, lng: 78.9629, radiusMeters: 100, isActive: true });
    setShowModal(true);
  }

  function openEdit(loc: any) {
    setEditing(loc);
    reset({
      name: loc.name,
      address: loc.address || '',
      lat: parseFloat(loc.lat),
      lng: parseFloat(loc.lng),
      radiusMeters: loc.radiusMeters ?? 100,
      isActive: loc.isActive ?? true,
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); reset(); }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lng = parseFloat(pos.coords.longitude.toFixed(7));
        setValue('lat', lat, { shouldValidate: true });
        setValue('lng', lng, { shouldValidate: true });
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      { timeout: 8000 }
    );
  }

  const handleMapChange = useCallback((lat: number, lng: number) => {
    setValue('lat', lat, { shouldValidate: true });
    setValue('lng', lng, { shouldValidate: true });
  }, [setValue]);

  const locations: any[] = data || [];

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Office Locations</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Define geo-fence boundaries. Employees must punch in from within the radius of any active location.
          </p>
        </div>
        <button onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <IconPlus size={16} /> Add Location
        </button>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#1d4ed8' }}>
        <strong>How geo-fence works:</strong> When an employee punches in with location sharing enabled, the system checks if they are within the radius of any active location. Employees with <em>Geo Exempt</em> flag bypass this check. If no locations are configured, the fence is not enforced.
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Loading...</div>
      ) : locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <IconMapPin size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No office locations yet</div>
          <div style={{ fontSize: 13 }}>Add your first location to enable geo-fence attendance.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {locations.map((loc: any) => (
            <div key={loc.id} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20,
              opacity: loc.isActive ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{loc.name}</div>
                  {loc.address && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{loc.address}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                      background: loc.isActive ? '#dcfce7' : '#f1f5f9',
                      color: loc.isActive ? '#166534' : '#64748b',
                    }}>
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                      ±{loc.radiusMeters}m radius
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(loc)} title="Edit"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                    <IconEdit size={15} />
                  </button>
                  <button onClick={() => toggleMutation.mutate({ id: loc.id, isActive: !loc.isActive })} title={loc.isActive ? 'Deactivate' : 'Activate'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: loc.isActive ? '#f59e0b' : '#22c55e', padding: 4 }}>
                    {loc.isActive ? <IconCircleX size={15} /> : <IconCircleCheck size={15} />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(loc.id)} title="Delete"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, fontVariantNumeric: 'tabular-nums' }}>
                <IconMapPin size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {parseFloat(loc.lat).toFixed(6)}, {parseFloat(loc.lng).toFixed(6)}
              </div>

              <div style={{ borderRadius: 8, overflow: 'hidden', height: 160, position: 'relative', border: '1px solid var(--color-border)' }}>
                <iframe
                  src={osmEmbedUrl(parseFloat(loc.lat), parseFloat(loc.lng))}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={`Map: ${loc.name}`}
                  loading="lazy"
                />
              </div>

              <a href={gmapsUrl(parseFloat(loc.lat), parseFloat(loc.lng))} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>
                <IconExternalLink size={12} /> Open in Google Maps
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 540, maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
              {editing ? 'Edit Location' : 'Add Office Location'}
            </h3>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Location Name *</label>
                <input {...register('name')} placeholder="e.g. Head Office, Bangalore Branch"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</span>}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Address (optional)</label>
                <textarea {...register('address')} placeholder="Full address for reference" rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              {/* Coordinates row */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Coordinates *</label>
                  <button type="button" onClick={useCurrentLocation} disabled={gettingLocation}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <IconCurrentLocation size={13} />
                    {gettingLocation ? 'Getting location...' : 'Use my location'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Latitude</label>
                    <input {...register('lat', { valueAsNumber: true })} placeholder="e.g. 12.971599"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                    {errors.lat && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.lat.message}</span>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Longitude</label>
                    <input {...register('lng', { valueAsNumber: true })} placeholder="e.g. 77.594566"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                    {errors.lng && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.lng.message}</span>}
                  </div>
                </div>
              </div>

              {/* Interactive map — always shown */}
              {hasValidCoords && (
                <DraggableMap
                  lat={watchLat}
                  lng={watchLng}
                  radius={watchRadius ?? 100}
                  onChange={handleMapChange}
                />
              )}

              {/* Geo-fence radius */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Geo-fence Radius: <span style={{ color: 'var(--color-primary)' }}>{watch('radiusMeters') ?? 100}m</span>
                </label>
                <input {...register('radiusMeters', { valueAsNumber: true })} type="range" min={10} max={1000} step={10}
                  style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <span>10m (strict)</span><span>500m</span><span>1000m (loose)</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input {...register('isActive')} type="checkbox" />
                Location is active (enforce geo-fence for this location)
              </label>

              {saveMutation.isError && (
                <div style={{ color: '#ef4444', fontSize: 13 }}>
                  {(saveMutation.error as any)?.response?.data?.error || 'Failed to save location'}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
