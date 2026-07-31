import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { IconBuilding, IconChevronDown, IconChevronRight, IconUsers } from '@tabler/icons-react';

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
function colorFor(str: string) {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function EmployeeCard({ emp }: { emp: any }) {
  const color = colorFor(emp.id);
  return (
    <Link to={`/employees/${emp.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: '10px 14px', cursor: 'pointer', minWidth: 200,
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: color + '20', color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0,
        }}>
          {initials(emp.name)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{emp.name}</div>
          {emp.designation && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{emp.designation}</div>}
        </div>
      </div>
    </Link>
  );
}

function MemberTree({ members }: { members: any[] }) {
  // Build manager → reports map
  const empMap = new Map(members.map(m => [m.id, m]));
  const reportMap = new Map<string | null, any[]>();
  for (const m of members) {
    const mgr = empMap.has(m.managerId) ? m.managerId : null;
    if (!reportMap.has(mgr)) reportMap.set(mgr, []);
    reportMap.get(mgr)!.push(m);
  }

  function renderNode(nodeId: string | null, depth: number): React.ReactNode {
    const group = reportMap.get(nodeId) || [];
    if (group.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.map(emp => (
          <div key={emp.id}>
            <EmployeeCard emp={emp} />
            {reportMap.has(emp.id) && (
              <div style={{ marginLeft: 24, marginTop: 6, paddingLeft: 16, borderLeft: '2px dashed var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {renderNode(emp.id, depth + 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <>{renderNode(null, 0)}</>;
}

function DeptNode({ dept }: { dept: any }) {
  const [open, setOpen] = useState(true);
  const memberCount = dept.members?.length || 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '10px 16px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: open ? 12 : 0,
          userSelect: 'none',
        }}>
        {open ? <IconChevronDown size={16} color="var(--color-text-secondary)" /> : <IconChevronRight size={16} color="var(--color-text-secondary)" />}
        <IconBuilding size={16} color="var(--color-primary)" />
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{dept.name}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
        {dept.children?.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
            · {dept.children.length} sub-dept
          </span>
        )}
      </div>

      {open && (
        <div style={{ marginLeft: 24, paddingLeft: 16, borderLeft: '2px solid var(--color-border)' }}>
          {memberCount > 0 && (
            <div style={{ marginBottom: 12 }}>
              <MemberTree members={dept.members} />
            </div>
          )}
          {(dept.children || []).map((child: any) => (
            <DeptNode key={child.id} dept={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['org-chart'],
    queryFn: () => api.get('/org-chart').then(r => r.data.data),
    staleTime: 120_000,
  });

  const totalMembers = (data || []).reduce((sum: number, d: any) => sum + (d.members?.length || 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <IconUsers size={22} color="var(--color-primary)" />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Org Chart</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {isLoading ? 'Loading...' : `${(data || []).length} departments · ${totalMembers} active employees`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading org chart...</div>
      ) : (data || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <IconBuilding size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          <div>No departments yet.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add departments and assign employees to build the org chart.</div>
        </div>
      ) : (
        <div>
          {(data || []).map((dept: any) => (
            <DeptNode key={dept.id} dept={dept} />
          ))}
        </div>
      )}
    </div>
  );
}
