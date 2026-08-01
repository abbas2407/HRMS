import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import {
  IconDashboard, IconUsers, IconClock, IconCalendar,
  IconMoneybag, IconFileText, IconSettings, IconBuilding,
  IconChartBar, IconBriefcase, IconArrowLeft, IconShield, IconMapPin,
  IconSpeakerphone, IconPackage, IconSchool, IconReceipt, IconAlertTriangle, IconUserSearch, IconClipboardList, IconHeadset, IconLogs, IconTable, IconVault, IconRadar,
} from '@tabler/icons-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function getNavSections(role: string): NavSection[] {
  if (role === 'HR_ADMIN') {
    return [
      {
        label: 'Overview',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: <IconDashboard size={16} /> },
        ]
      },
      {
        label: 'HR',
        items: [
          { label: 'Employees', path: '/employees', icon: <IconUsers size={16} /> },
          { label: 'Org Chart', path: '/org-chart', icon: <IconBuilding size={16} /> },
          { label: 'Announcements', path: '/announcements', icon: <IconSpeakerphone size={16} /> },
          { label: 'HR Letters', path: '/letters', icon: <IconFileText size={16} /> },
          { label: 'Performance', path: '/performance', icon: <IconChartBar size={16} /> },
          { label: 'Training', path: '/training', icon: <IconSchool size={16} /> },
          { label: 'Expenses', path: '/expenses', icon: <IconReceipt size={16} /> },
          { label: 'Grievances', path: '/grievances', icon: <IconAlertTriangle size={16} /> },
          { label: 'Recruitment', path: '/recruitment', icon: <IconUserSearch size={16} /> },
          { label: 'Surveys', path: '/surveys', icon: <IconClipboardList size={16} /> },
          { label: 'Help Desk', path: '/helpdesk', icon: <IconHeadset size={16} /> },
          { label: 'Timesheet', path: '/timesheet', icon: <IconTable size={16} /> },
          { label: 'Document Vault', path: '/vault', icon: <IconVault size={16} /> },
          { label: 'Onboarding', path: '/onboarding', icon: <IconBriefcase size={16} /> },
          { label: 'Separation', path: '/separation', icon: <IconArrowLeft size={16} /> },
        ]
      },
      {
        label: 'Attendance',
        items: [
          { label: 'Register', path: '/attendance/register', icon: <IconClock size={16} /> },
          { label: 'Live Board', path: '/attendance/live', icon: <IconDashboard size={16} /> },
          { label: 'Regularisation', path: '/regularisation', icon: <IconCalendar size={16} /> },
          { label: 'Shifts', path: '/shifts', icon: <IconSettings size={16} /> },
          { label: 'Geo-fence Monitor', path: '/geo-fence', icon: <IconRadar size={16} /> },
        ]
      },
      {
        label: 'Leave',
        items: [
          { label: 'Leave Requests', path: '/leaves', icon: <IconCalendar size={16} /> },
          { label: 'Leave Balance', path: '/leave-balance', icon: <IconCalendar size={16} /> },
          { label: 'Holiday Calendar', path: '/holidays', icon: <IconCalendar size={16} /> },
          { label: 'Leave Types', path: '/leave-types', icon: <IconSettings size={16} /> },
        ]
      },
      {
        label: 'Payroll',
        items: [
          { label: 'Payroll Runs', path: '/payroll', icon: <IconMoneybag size={16} /> },
          { label: 'Salary Structure', path: '/salary-structure', icon: <IconFileText size={16} /> },
        ]
      },
      {
        label: 'Compliance',
        items: [
          { label: 'PF / EPF', path: '/compliance/pf', icon: <IconShield size={16} /> },
          { label: 'ESIC', path: '/compliance/esic', icon: <IconShield size={16} /> },
          { label: 'TDS / Form 16', path: '/compliance/tds', icon: <IconShield size={16} /> },
          { label: 'Professional Tax', path: '/compliance/pt', icon: <IconShield size={16} /> },
        ]
      },
      {
        label: 'Reports',
        items: [
          { label: 'Reports', path: '/reports', icon: <IconChartBar size={16} /> },
        ]
      },
      {
        label: 'Setup',
        items: [
          { label: 'Company Settings', path: '/settings', icon: <IconSettings size={16} /> },
          { label: 'Departments', path: '/departments', icon: <IconBuilding size={16} /> },
          { label: 'Designations', path: '/designations', icon: <IconBriefcase size={16} /> },
          { label: 'Office Locations', path: '/settings/office-locations', icon: <IconMapPin size={16} /> },
          { label: 'Assets', path: '/assets', icon: <IconPackage size={16} /> },
          { label: 'Audit Log', path: '/audit-log', icon: <IconLogs size={16} /> },
        ]
      },
      {
        label: 'Account',
        items: [
          { label: 'My Profile', path: '/profile', icon: <IconUsers size={16} /> },
        ]
      },
    ];
  }

  if (role === 'MANAGER') {
    return [
      { label: 'Overview', items: [{ label: 'Dashboard', path: '/dashboard', icon: <IconDashboard size={16} /> }] },
      { label: 'My Team', items: [{ label: 'Team Members', path: '/employees', icon: <IconUsers size={16} /> }] },
      { label: 'Attendance', items: [
        { label: 'Team Attendance', path: '/attendance/register', icon: <IconClock size={16} /> },
        { label: 'Punch In / Out', path: '/attendance/punch', icon: <IconClock size={16} /> },
      ]},
      { label: 'Leave', items: [{ label: 'Leave Approvals', path: '/leaves', icon: <IconCalendar size={16} /> }] },
      { label: 'Company', items: [
        { label: 'Announcements', path: '/announcements', icon: <IconSpeakerphone size={16} /> },
        { label: 'Performance', path: '/performance', icon: <IconChartBar size={16} /> },
        { label: 'Training', path: '/training', icon: <IconSchool size={16} /> },
        { label: 'Expenses', path: '/expenses', icon: <IconReceipt size={16} /> },
        { label: 'Grievances', path: '/grievances', icon: <IconAlertTriangle size={16} /> },
        { label: 'Surveys', path: '/surveys', icon: <IconClipboardList size={16} /> },
        { label: 'Help Desk', path: '/helpdesk', icon: <IconHeadset size={16} /> },
        { label: 'Timesheet', path: '/timesheet', icon: <IconTable size={16} /> },
        { label: 'Document Vault', path: '/vault', icon: <IconVault size={16} /> },
      ]},
      { label: 'Account', items: [{ label: 'My Profile', path: '/profile', icon: <IconUsers size={16} /> }] },
    ];
  }

  // EMPLOYEE
  return [
    { label: 'Overview', items: [{ label: 'Dashboard', path: '/dashboard', icon: <IconDashboard size={16} /> }] },
    { label: 'Company', items: [
      { label: 'Announcements', path: '/announcements', icon: <IconSpeakerphone size={16} /> },
      { label: 'Performance', path: '/performance', icon: <IconChartBar size={16} /> },
      { label: 'Training', path: '/training', icon: <IconSchool size={16} /> },
      { label: 'Expenses', path: '/expenses', icon: <IconReceipt size={16} /> },
      { label: 'Grievances', path: '/grievances', icon: <IconAlertTriangle size={16} /> },
      { label: 'Surveys', path: '/surveys', icon: <IconClipboardList size={16} /> },
      { label: 'Help Desk', path: '/helpdesk', icon: <IconHeadset size={16} /> },
      { label: 'Timesheet', path: '/timesheet', icon: <IconTable size={16} /> },
      { label: 'Document Vault', path: '/vault', icon: <IconVault size={16} /> },
    ]},
    {
      label: 'Attendance',
      items: [
        { label: 'Punch In / Out', path: '/attendance/punch', icon: <IconClock size={16} /> },
        { label: 'My Attendance', path: '/attendance/my', icon: <IconCalendar size={16} /> },
        { label: 'Regularisation', path: '/regularisation', icon: <IconCalendar size={16} /> },
      ]
    },
    {
      label: 'Leave',
      items: [
        { label: 'Apply / My Leaves', path: '/leaves', icon: <IconCalendar size={16} /> },
        { label: 'Leave Balance', path: '/leave-balance', icon: <IconCalendar size={16} /> },
        { label: 'Holiday Calendar', path: '/holidays', icon: <IconCalendar size={16} /> },
      ]
    },
    {
      label: 'Payroll',
      items: [
        { label: 'My Payslips', path: '/payslips', icon: <IconMoneybag size={16} /> },
        { label: 'Form 16 / TDS', path: '/compliance/tds', icon: <IconFileText size={16} /> },
      ]
    },
    {
      label: 'My Profile',
      items: [
        { label: 'Personal Info', path: '/profile', icon: <IconUsers size={16} /> },
        { label: 'My Documents', path: '/vault', icon: <IconFileText size={16} /> },
      ]
    },
  ];
}

export default function Sidebar() {
  const { user } = useAuthStore();
  const role = user?.role || 'EMPLOYEE';
  const sections = getNavSections(role);

  return (
    <nav className="sidebar">
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, height: 'var(--topbar-h)' }}>
        <div style={{ width: 28, height: 28, background: 'var(--brand)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>C</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>CyberlinkHR</span>
      </div>

      <div style={{ padding: '8px 8px' }}>
        {sections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--danger)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 999,
                    padding: '1px 6px',
                    minWidth: 18,
                    textAlign: 'center'
                  }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
