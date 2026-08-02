import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import { SkeletonTable } from './Skeleton';
import Badge from './Badge';
import { IconChevronLeft, IconChevronRight, IconSearch, IconDownload } from '@tabler/icons-react';

interface Column {
  header: string;
  key: string;
  sortable?: boolean;
  render?: (val: any, row: any) => React.ReactNode;
}

interface FilterField {
  name: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
}

interface ListTableProps {
  columns: Column[];
  endpoint: string;
  filterConfig?: FilterField[];
  onRowClick?: (row: any) => void;
  bulkActions?: { label: string; action: (ids: string[]) => Promise<void> }[];
  entityName?: string;
}

export default function ListTable({
  columns,
  endpoint,
  filterConfig = [],
  onRowClick,
  bulkActions = [],
  entityName = 'records',
}: ListTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchData = () => {
    setLoading(true);
    const params = {
      search: search || undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortBy ? sortOrder : undefined,
      page,
      limit,
      ...filters,
    };
    api.get(endpoint, { params })
      .then((res) => {
        setData(res.data.data || []);
        setTotal(res.data.meta?.total || res.data.data?.length || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [endpoint, search, filters, sortBy, sortOrder, page, limit]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(key);
      setSortOrder('ASC');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(data.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const exportToCSV = () => {
    if (!data.length) return;
    const headers = columns.map((col) => col.header).join(',');
    const rows = data.map((row) =>
      columns.map((col) => {
        const val = row[col.key];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? '';
      }).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${entityName}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkAction = async (actionFn: (ids: string[]) => Promise<void>) => {
    if (!selectedIds.length) return;
    try {
      await actionFn(selectedIds);
      setSelectedIds([]);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            placeholder={`Search ${entityName}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        {filterConfig.map((f) => {
          if (f.type === 'select') {
            return (
              <div key={f.name} style={{ minWidth: 120 }}>
                <Select
                  options={(f.options || []).map((o) => ({ value: o, label: o }))}
                  value={filters[f.name] || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={`All ${f.label}`}
                />
              </div>
            );
          }
          return null;
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="default" size="sm" icon={<IconDownload size={14} />} onClick={exportToCSV}>
            Export CSV
          </Button>

          {selectedIds.length > 0 && bulkActions.map((action, i) => (
            <Button
              key={i}
              variant="danger"
              size="sm"
              onClick={() => handleBulkAction(action.action)}
            >
              {action.label} ({selectedIds.length})
            </Button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-s)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', width: 40 }}>
                <input
                  type="checkbox"
                  checked={data.length > 0 && selectedIds.length === data.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    cursor: col.sortable ? 'pointer' : 'default',
                  }}
                  className="th-label"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    {sortBy === col.key && (
                      <span style={{ fontSize: 10 }}>{sortOrder === 'ASC' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: 16 }}>
                  <SkeletonTable rows={limit} cols={columns.length + 1} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  No {entityName} found
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: onRowClick ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  <td style={{ padding: '10px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleSelectRow(e, row.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '10px 16px', fontSize: 13 }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--text-2)' }}>
        <div>
          Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} {entityName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 6px',
                background: 'var(--bg-surface)',
                outline: 'none',
              }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              variant="default"
              size="sm"
              icon={<IconChevronLeft size={14} />}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            />
            <Button
              variant="default"
              size="sm"
              icon={<IconChevronRight size={14} />}
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
