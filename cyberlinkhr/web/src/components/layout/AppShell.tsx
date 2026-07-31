import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SetupWizard from './SetupWizard';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export default function AppShell() {
  const { user } = useAuthStore();
  const [wizardDismissed, setWizardDismissed] = useState(() =>
    localStorage.getItem('setup_wizard_done') === '1'
  );

  const { data: stats } = useQuery({
    queryKey: ['employee-stats'],
    queryFn: () => api.get('/employees/stats').then(r => r.data.data),
    enabled: !!user && !wizardDismissed,
    staleTime: 60_000,
  });

  const showWizard = !wizardDismissed && stats?.total === 0;

  const handleClose = () => {
    localStorage.setItem('setup_wizard_done', '1');
    setWizardDismissed(true);
  };

  return (
    <div style={{ display: 'flex' }}>
      {showWizard && <SetupWizard onClose={handleClose} />}
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-w)' }}>
        <Topbar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
