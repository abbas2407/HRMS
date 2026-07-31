type BadgeVariant = 'success' | 'warning' | 'danger' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  success: { background: 'var(--success-l)', color: 'var(--success)' },
  warning: { background: 'var(--warning-l)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-l)', color: 'var(--danger)' },
  blue: { background: 'var(--brand-l)', color: 'var(--brand)' },
  gray: { background: 'var(--bg-subtle)', color: 'var(--text-2)' },
  purple: { background: 'var(--purple-l)', color: 'var(--purple)' },
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  blue: 'var(--brand)',
  gray: 'var(--text-3)',
  purple: 'var(--purple)',
};

export default function Badge({ variant = 'gray', children, dot = true }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      borderRadius: 'var(--badge-radius)',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 500,
      ...styles[variant],
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColors[variant],
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}

export function statusToBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'success', APPROVED: 'success', PRESENT: 'success',
    TRIAL: 'blue', PENDING: 'warning', LATE: 'warning',
    EXPIRED: 'danger', REJECTED: 'danger', ABSENT: 'danger',
    SUSPENDED: 'gray', INACTIVE: 'gray', CANCELLED: 'gray',
    TRIAL_EXPIRED: 'danger',
  };
  return map[status] || 'gray';
}
