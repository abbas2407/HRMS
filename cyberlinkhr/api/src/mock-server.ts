import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substring(2, 15);

// In-memory Database state
const state = {
  settings: {
    company_name: 'Demo Company',
    state: 'MH',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    week_off_days: '0,6',
    financial_year_start: '4',
    payroll_cutoff_day: '25',
    probation_days: '90',
  } as Record<string, string>,

  departments: [
    { id: 'dept-1', name: 'Engineering' },
    { id: 'dept-2', name: 'Human Resources' },
    { id: 'dept-3', name: 'Finance' },
  ],

  designations: [
    { id: 'desig-1', name: 'Chief Executive Officer', grade: 'L10', level: 10 },
    { id: 'desig-2', name: 'Engineering Manager', grade: 'L7', level: 7 },
    { id: 'desig-3', name: 'Senior Software Engineer', grade: 'L5', level: 5 },
    { id: 'desig-4', name: 'Software Engineer', grade: 'L4', level: 4 },
  ],

  shifts: [
    { id: 'shift-1', name: 'Day Shift', startTime: '09:00', endTime: '18:00' },
  ],

  employees: [
    { id: 'emp-1', employeeCode: 'EMP-001', firstName: 'HR', lastName: 'Admin', email: 'hr@demo.com', phone: '9999999991', gender: 'FEMALE', dob: '1990-05-15', joiningDate: '2020-01-01', departmentId: 'dept-2', designationId: 'desig-2', employmentType: 'FULL_TIME', workLocation: 'Mumbai', status: 'ACTIVE' },
    { id: 'emp-2', employeeCode: 'EMP-002', firstName: 'Team', lastName: 'Manager', email: 'manager@demo.com', phone: '9999999992', gender: 'MALE', dob: '1988-08-20', joiningDate: '2021-06-01', departmentId: 'dept-1', designationId: 'desig-2', employmentType: 'FULL_TIME', workLocation: 'Bangalore', status: 'ACTIVE' },
    { id: 'emp-3', employeeCode: 'EMP-003', firstName: 'John', lastName: 'Doe', email: 'employee@demo.com', phone: '9999999993', gender: 'MALE', dob: '1995-10-10', joiningDate: '2022-03-15', departmentId: 'dept-1', designationId: 'desig-4', employmentType: 'FULL_TIME', workLocation: 'Pune', status: 'ACTIVE' },
  ] as any[],

  attendance: [] as any[],

  leaves: [
    { id: 'leave-1', employeeId: 'emp-3', employeeName: 'John Doe', type: 'Casual', startDate: '2026-08-10', endDate: '2026-08-12', days: 3, reason: 'Family function', status: 'PENDING', current_state: 'Pending' }
  ] as any[],

  announcements: [
    { id: 'ann-1', title: 'Welcome to CyberlinkHR', content: 'Our new portal is now live!', isPinned: true, createdAt: new Date() }
  ] as any[],

  expenses: [] as any[],
  grievances: [] as any[],
  surveys: [] as any[],
  helpdesk: [] as any[],
  timesheets: [] as any[],
  vaultFolders: [
    { id: 'f-1', name: 'Company Policies', description: 'Rules and regulations handbook', icon: 'folder', targetType: 'ALL' }
  ] as any[],
  vaultFiles: [] as any[],

  customFields: [] as any[],
  permissions: [] as any[],

  tenants: [
    { id: 'tenant-demo', name: 'Demo Company', slug: 'demo', schemaName: 'tenant_demo', status: 'TRIAL', trialEndsAt: new Date(Date.now() + 14 * 864e5), employeeCount: 3 }
  ] as any[],

  notifications: [] as any[],
};

// Seed default permissions
const MODULES = ['employee', 'asset', 'leave', 'grievances'];
const ROLES = ['HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT', 'AUDITOR'];
ROLES.forEach(r => {
  MODULES.forEach(m => {
    state.permissions.push({
      role: r,
      module: m,
      canRead: true,
      canWrite: r === 'HR_ADMIN' || r === 'MANAGER',
      canCreate: r === 'HR_ADMIN' || r === 'MANAGER',
      canDelete: r === 'HR_ADMIN',
      canSubmit: r === 'HR_ADMIN' || r === 'MANAGER',
      canCancel: r === 'HR_ADMIN',
      canExport: true
    });
  });
});

// Middleware to mock runInTenant
app.use((req, res, next) => {
  (req as any).user = { userId: 'emp-1', email: 'hr@demo.com', role: 'HR_ADMIN', employeeId: 'emp-1' };
  next();
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, slug } = req.body;
  const user = state.employees.find(e => e.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const role = email === 'manager@demo.com' ? 'MANAGER' : email === 'hr@demo.com' ? 'HR_ADMIN' : 'EMPLOYEE';
  return res.json({
    data: {
      user: { id: user.id, email: user.email, role },
      tenant: { id: 'tenant-demo', name: 'Demo Company', slug: 'demo', status: 'TRIAL' },
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh'
    }
  });
});

app.post('/api/vendor/auth/login', (req, res) => {
  const { email } = req.body;
  if (email === 'admin@cyberlink.co.in') {
    return res.json({
      data: {
        user: { id: 'vendor-id', name: 'Vendor Admin', email: 'admin@cyberlink.co.in' },
        token: 'mock-vendor-token'
      }
    });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/refresh', (req, res) => {
  return res.json({ data: { accessToken: 'mock-token-refreshed' } });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  res.json({ data: state.settings });
});

app.put('/api/settings/bulk', (req, res) => {
  Object.assign(state.settings, req.body);
  res.json({ data: state.settings });
});

// Custom fields
app.get('/api/framework/customisation/fields/:module', (req, res) => {
  res.json({ data: state.customFields.filter(f => f.module === req.params.module) });
});

app.post('/api/framework/customisation/fields', (req, res) => {
  const field = { id: uuid(), ...req.body, isActive: true };
  state.customFields.push(field);
  res.status(201).json({ data: field });
});

app.delete('/api/framework/customisation/fields/:id', (req, res) => {
  state.customFields = state.customFields.filter(f => f.id !== req.params.id);
  res.json({ data: { success: true } });
});

// Permissions matrix
app.get('/api/framework/permissions', (req, res) => {
  res.json({ data: state.permissions });
});

app.put('/api/framework/permissions', (req, res) => {
  const { role, module } = req.body;
  const existingIdx = state.permissions.findIndex(p => p.role === role && p.module === module);
  if (existingIdx >= 0) {
    Object.assign(state.permissions[existingIdx], req.body);
    res.json({ data: state.permissions[existingIdx] });
  } else {
    state.permissions.push(req.body);
    res.json({ data: req.body });
  }
});

// Departments & Designations & Shifts
app.get('/api/departments', (req, res) => res.json({ data: state.departments }));
app.post('/api/departments', (req, res) => {
  const d = { id: uuid(), ...req.body };
  state.departments.push(d);
  res.status(201).json({ data: d });
});

app.get('/api/designations', (req, res) => res.json({ data: state.designations }));
app.post('/api/designations', (req, res) => {
  const d = { id: uuid(), ...req.body };
  state.designations.push(d);
  res.status(201).json({ data: d });
});

app.get('/api/shifts', (req, res) => res.json({ data: state.shifts }));
app.post('/api/shifts', (req, res) => {
  const s = { id: uuid(), ...req.body };
  state.shifts.push(s);
  res.status(201).json({ data: s });
});

// Employees
app.get('/api/employees/stats', (req, res) => {
  const active = state.employees.filter(e => e.status === 'ACTIVE').length;
  const inactive = state.employees.filter(e => e.status === 'INACTIVE').length;
  const separated = state.employees.filter(e => e.status === 'SEPARATED').length;
  res.json({ data: { total: state.employees.length, active, inactive, separated } });
});

app.get('/api/employees', (req, res) => res.json({ data: state.employees }));
app.post('/api/employees', (req, res) => {
  const code = `EMP-${String(state.employees.length + 1).padStart(3, '0')}`;
  const emp = { id: uuid(), employeeCode: code, ...req.body, status: 'ACTIVE' };
  state.employees.push(emp);
  res.status(201).json({ data: emp });
});

app.get('/api/employees/:id', (req, res) => {
  const emp = state.employees.find(e => e.id === req.params.id);
  res.json({ data: emp });
});

app.put('/api/employees/:id', (req, res) => {
  const idx = state.employees.findIndex(e => e.id === req.params.id);
  if (idx >= 0) {
    Object.assign(state.employees[idx], req.body);
    res.json({ data: state.employees[idx] });
  } else {
    res.status(404).json({ error: 'Employee not found' });
  }
});

// Attendance & Punch
app.get('/api/attendance/register', (req, res) => {
  res.json({ data: state.attendance });
});

app.get('/api/attendance/my', (req, res) => {
  res.json({ data: state.attendance.filter(a => a.employeeId === 'emp-3') });
});

app.post('/api/attendance/punch', (req, res) => {
  const { type, location } = req.body;
  const empId = req.headers['authorization']?.includes('manager') ? 'emp-2' : 'emp-3';
  const user = state.employees.find(e => e.id === empId);
  const log = {
    id: uuid(),
    employeeId: empId,
    employeeName: user ? `${user.firstName} ${user.lastName}` : 'Employee',
    timestamp: new Date(),
    type,
    location,
    source: 'WEB'
  };
  state.attendance.push(log);
  res.json({ message: 'Punch registered successfully', data: log });
});

app.post('/api/attendance/punch-in', (req, res) => {
  const empId = req.headers['authorization']?.includes('manager') ? 'emp-2' : 'emp-3';
  const user = state.employees.find(e => e.id === empId);
  const log = {
    id: uuid(),
    employeeId: empId,
    employeeName: user ? `${user.firstName} ${user.lastName}` : 'Employee',
    punchIn: new Date().toISOString().split('T')[1].slice(0, 8),
    date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
    source: 'MOBILE'
  };
  state.attendance.push(log);
  res.json({ message: 'Punched in successfully', data: log });
});

app.post('/api/attendance/punch-out', (req, res) => {
  const empId = req.headers['authorization']?.includes('manager') ? 'emp-2' : 'emp-3';
  const existing = state.attendance.find(a => a.employeeId === empId && !a.punchOut);
  if (existing) {
    existing.punchOut = new Date().toISOString().split('T')[1].slice(0, 8);
  }
  res.json({ message: 'Punched out successfully', data: existing || null });
});

// Leave approvals
app.get('/api/leaves', (req, res) => res.json({ data: state.leaves }));
app.post('/api/leaves', (req, res) => {
  const l = { id: uuid(), employeeId: 'emp-3', employeeName: 'John Doe', status: 'PENDING', current_state: 'Pending', ...req.body };
  state.leaves.push(l);
  res.status(201).json({ data: l });
});

app.post('/api/leaves/:id/approve', (req, res) => {
  const idx = state.leaves.findIndex(l => l.id === req.params.id);
  if (idx >= 0) {
    state.leaves[idx].status = 'APPROVED';
    state.leaves[idx].current_state = 'Approved';
    res.json({ data: state.leaves[idx] });
  } else {
    res.status(404).json({ error: 'Leave not found' });
  }
});

// Announcements
app.get('/api/announcements', (req, res) => res.json({ data: state.announcements }));
app.post('/api/announcements', (req, res) => {
  const a = { id: uuid(), createdAt: new Date(), isPinned: false, ...req.body };
  state.announcements.push(a);
  res.status(201).json({ data: a });
});

// Expenses
app.get('/api/expenses', (req, res) => res.json({ data: state.expenses }));
app.post('/api/expenses', (req, res) => {
  const e = { id: uuid(), employeeId: 'emp-3', employeeName: 'John Doe', status: 'PENDING', ...req.body };
  state.expenses.push(e);
  res.status(201).json({ data: e });
});

// Grievances
app.get('/api/grievances', (req, res) => res.json({ data: state.grievances }));
app.post('/api/grievances', (req, res) => {
  const g = { id: uuid(), employeeId: 'emp-3', employeeName: 'John Doe', status: 'OPEN', ...req.body };
  state.grievances.push(g);
  res.status(201).json({ data: g });
});

// Surveys
app.get('/api/surveys', (req, res) => res.json({ data: state.surveys }));
app.post('/api/surveys', (req, res) => {
  const s = { id: uuid(), status: 'ACTIVE', ...req.body };
  state.surveys.push(s);
  res.status(201).json({ data: s });
});

// Helpdesk
app.get('/api/helpdesk', (req, res) => res.json({ data: state.helpdesk }));
app.post('/api/helpdesk', (req, res) => {
  const t = { id: uuid(), employeeId: 'emp-3', employeeName: 'John Doe', status: 'OPEN', ...req.body };
  state.helpdesk.push(t);
  res.status(201).json({ data: t });
});

// Timesheets
app.get('/api/timesheet', (req, res) => res.json({ data: state.timesheets }));
app.post('/api/timesheet', (req, res) => {
  const t = { id: uuid(), employeeId: 'emp-3', employeeName: 'John Doe', ...req.body };
  state.timesheets.push(t);
  res.status(201).json({ data: t });
});

// Vault
app.get('/api/vault/folders', (req, res) => res.json({ data: state.vaultFolders }));
app.post('/api/vault/folders', (req, res) => {
  const f = { id: uuid(), ...req.body };
  state.vaultFolders.push(f);
  res.status(201).json({ data: f });
});

app.get('/api/vault/documents', (req, res) => res.json({ data: state.vaultFiles }));
app.post('/api/vault/documents', (req, res) => {
  const doc = { id: uuid(), name: req.body.name || 'document.pdf', sizeBytes: 102400, mime: 'application/pdf', uploadedAt: new Date(), ...req.body };
  state.vaultFiles.push(doc);
  res.status(201).json({ data: doc });
});

// Notifications
app.get('/api/notifications', (req, res) => res.json({ data: state.notifications }));
app.patch('/api/notifications/read-all', (req, res) => {
  state.notifications.forEach(n => n.readAt = new Date());
  res.json({ success: true });
});

// Import Company Data Endpoint (Requirement 7)
app.post('/api/settings/import-company', (req, res) => {
  const { departments, designations, shifts, employees: importedEmployees } = req.body;

  if (departments && Array.isArray(departments)) {
    departments.forEach((d: any) => {
      if (d.name && !state.departments.some(ex => ex.name.toLowerCase() === d.name.toLowerCase())) {
        state.departments.push({ id: uuid(), name: d.name });
      }
    });
  }

  if (designations && Array.isArray(designations)) {
    designations.forEach((d: any) => {
      if (d.name && !state.designations.some(ex => ex.name.toLowerCase() === d.name.toLowerCase())) {
        state.designations.push({ id: uuid(), name: d.name, grade: d.grade || 'L1', level: d.level || 1 });
      }
    });
  }

  if (shifts && Array.isArray(shifts)) {
    shifts.forEach((s: any) => {
      if (s.name && !state.shifts.some(ex => ex.name.toLowerCase() === s.name.toLowerCase())) {
        state.shifts.push({ id: uuid(), name: s.name, startTime: s.startTime || '09:00', endTime: s.endTime || '18:00' });
      }
    });
  }

  let count = 0;
  if (importedEmployees && Array.isArray(importedEmployees)) {
    importedEmployees.forEach((e: any) => {
      if (e.firstName && e.lastName && e.email) {
        if (!state.employees.some(ex => ex.email === e.email)) {
          const dept = state.departments.find(d => d.name.toLowerCase() === (e.departmentName || '').toLowerCase());
          const desig = state.designations.find(d => d.name.toLowerCase() === (e.designationName || '').toLowerCase());
          const code = `EMP-${String(state.employees.length + 1).padStart(3, '0')}`;
          state.employees.push({
            id: uuid(),
            employeeCode: code,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            phone: e.phone || '',
            gender: e.gender || 'MALE',
            dob: e.dob || '1995-01-01',
            joiningDate: e.joiningDate || '2023-01-01',
            departmentId: dept ? dept.id : null,
            designationId: desig ? desig.id : null,
            employmentType: e.employmentType || 'FULL_TIME',
            workLocation: e.workLocation || 'Mumbai',
            status: 'ACTIVE'
          });
          count++;
        }
      }
    });
  }

  // Sync tenant counts
  const tenant = state.tenants.find(t => t.slug === 'demo');
  if (tenant) tenant.employeeCount = state.employees.length;

  res.status(201).json({
    data: {
      message: 'Company data imported successfully',
      importedEmployees: count,
      totalEmployees: state.employees.length,
      totalDepartments: state.departments.length,
      totalDesignations: state.designations.length,
    }
  });
});

// Vendor panel endpoints
app.get('/api/vendor/dashboard', (req, res) => {
  const mrr = state.tenants.length * 999;
  res.json({
    data: {
      total: state.tenants.length,
      active: state.tenants.filter(t => t.status === 'ACTIVE' || t.status === 'TRIAL').length,
      trial: state.tenants.filter(t => t.status === 'TRIAL').length,
      expiring7: 0,
      expiring14: 0,
      expiring30: 0,
      mrr,
      recentTenants: state.tenants,
      expiringList: []
    }
  });
});

app.get('/api/vendor/companies', (req, res) => {
  res.json({ data: state.tenants });
});

app.post('/api/vendor/companies', (req, res) => {
  const { name, slug } = req.body;
  const company = {
    id: uuid(),
    name,
    slug,
    schemaName: `tenant_${slug}`,
    status: 'TRIAL',
    trialEndsAt: new Date(Date.now() + 14 * 864e5),
    employeeCount: 0
  };
  state.tenants.push(company);
  res.status(201).json({ data: company });
});

// Listen
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Mock API Server running on port ${PORT}`);
});
