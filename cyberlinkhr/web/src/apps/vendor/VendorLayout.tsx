import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useVendorAuthStore } from '@/stores/vendor-auth.store';
import {
  IconDashboard, IconBuilding, IconClock, IconPlus,
  IconMoneybag, IconFileText, IconSettings, IconBell,
  IconAlertTriangle, IconBan, IconChartBar, IconLogout,
} from '@tabler/icons-react';
import Avatar from '@/components/ui/Avatar';

export default function VendorLayout() {
  const { vendorUser, clearAuth } = useVendorAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate('/vendor/login');
  }

  const sections = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', path: '/vendor/dashboard', icon: <IconDashboard size={16} /> },
        { label: 'MRR & Revenue', path: '/vendor/billing', icon: <IconChartBar size={16} /> },
      ],
    },
    {
      label: 'Companies',
      items: [
        { label: 'All Companies', path: '/vendor/companies', icon: <IconBuilding size={16} /> },
        { label: 'Trial Accounts', path: '/vendor/companies?status=TRIAL', icon: <IconClock size={16} /> },
        { label: 'Expiring Soon', path: '/vendor/expiring', icon: <IconAlertTriangle size={16} /> },
        { label: 'Suspended', path: '/vendor/companies?status=SUSPENDED', icon: <IconBan size={16} /> },
        { label: 'Create Company', path: '/vendor/companies/new', icon: <IconPlus size={16} /> },
      ],
    },
    {
      label: 'Billing',
      items: [
        { label: 'Payments', path: '/vendor/billing', icon: <IconMoneybag size={16} /> },
        { label: 'Invoices', path: '/vendor/billing', icon: <IconFileText size={16} /> },
        { label: 'Plans', path: '/vendor/settings', icon: <IconSettings size={16} /> },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Announcements', path: '/vendor/announcements', icon: <IconBell size={16} /> },
        { label: 'Audit Log', path: '/vendor/audit-log', icon: <IconFileText size={16} /> },
        { label: 'Settings', path: '/vendor/settings', icon: <IconSettings size={16} /> },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, minWidth: 220, background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)', height: '100vh',
        position: 'fixed', top: 0, left: 0, overflow: 'auto', zIndex: 50,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '0 12px', height: 52, display: 'flex', alignItems: 'center',
          gap: 8, borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ width: 28, height: 28, background: 'var(--purple)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>V</span>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>CyberlinkHR</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Vendor Portal</div>
          </div>
        </div>

        <div style={{ padding: '8px', flex: 1 }}>
          {sections.map((s) => (
            <div key={s.label}>
              <div className="sidebar-section-label">{s.label}</div>
              {s.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={vendorUser?.name || 'V'} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendorUser?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Vendor Admin</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
            <IconLogout size={16} />
          </button>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, marginLeft: 220 }}>
        <header style={{
          height: 52, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Vendor Administration Panel</span>
        </header>
        <main style={{ padding: 24, minHeight: 'calc(100vh - 52px)', background: 'var(--bg-base)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
