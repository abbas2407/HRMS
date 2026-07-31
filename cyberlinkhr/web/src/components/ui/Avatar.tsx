interface AvatarProps {
  name: string;
  size?: number;
  src?: string;
}

function getInitials(name: string): string {
  return name.split(/[\s@.]+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

function getColor(name: string): string {
  const colors = ['#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#BE185D'];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function Avatar({ name, size = 32, src }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: getColor(name),
      color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}
