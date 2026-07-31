import { useEffect, useState } from 'react';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';

export type ToastType = 'success' | 'error' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export function toast(type: ToastType, message: string) {
  addToastFn?.(type, message);
}
toast.success = (msg: string) => toast('success', msg);
toast.error = (msg: string) => toast('error', msg);
toast.warning = (msg: string) => toast('warning', msg);

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (type, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  const icons = { success: <IconCheck size={14} />, error: <IconX size={14} />, warning: <IconAlertTriangle size={14} /> };
  const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)' };
  const bgs = { success: 'var(--success-l)', error: 'var(--danger-l)', warning: 'var(--warning-l)' };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${colors[t.type]}`,
            borderRadius: 'var(--card-radius)',
            padding: '10px 14px',
            boxShadow: 'var(--modal-shadow)',
            minWidth: 280, maxWidth: 380,
            animation: 'slideIn 0.2s ease',
          }}
        >
          <span style={{ color: colors[t.type] }}>{icons[t.type]}</span>
          <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
