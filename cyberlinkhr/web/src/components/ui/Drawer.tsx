import React from 'react';
import { IconX } from '@tabler/icons-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
      background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)', transition: 'opacity 0.2s'
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0 }}
      />
      <div style={{
        position: 'relative', width: 360, maxWidth: '90vw', height: '100%',
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
        zIndex: 1001, animation: 'slideLeft 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
