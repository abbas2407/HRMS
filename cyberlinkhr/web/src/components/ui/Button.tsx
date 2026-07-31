import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'default' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export default function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 'var(--btn-radius)',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'background 0.1s, border-color 0.1s',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
    fontSize: size === 'sm' ? 12 : 12.5,
    padding: size === 'sm' ? '4px 10px' : '6px 12px',
    opacity: disabled || loading ? 0.6 : 1,
  };

  const variants: Record<Variant, React.CSSProperties> = {
    primary: { background: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' },
    default: { background: 'var(--bg-surface)', color: 'var(--text-1)', borderColor: 'var(--border)' },
    danger: { background: 'var(--danger-l)', color: 'var(--danger)', borderColor: 'var(--danger)' },
    ghost: { background: 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
  };

  return (
    <button
      style={{ ...base, ...variants[variant] }}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading ? <span style={{ fontSize: 12 }}>⟳</span> : icon}
      {children}
    </button>
  );
}
