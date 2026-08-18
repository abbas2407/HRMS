import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  date,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'OTHER']);
export const employmentTypeEnum = pgEnum('employment_type', [
  'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN',
]);
export const employeeStatusEnum = pgEnum('employee_status', [
  'ACTIVE', 'INACTIVE', 'SEPARATED',
]);
export const attendanceStatusEnum = pgEnum('attendance_status', [
  'PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEK_OFF',
]);
export const attendanceSourceEnum = pgEnum('attendance_source', [
  'WEB', 'MOBILE', 'BIOMETRIC', 'MANUAL',
]);
export const payrollRunStatusEnum = pgEnum('payroll_run_status', [
  'DRAFT', 'LOCKED', 'DISBURSED',
]);
export const leaveRequestStatusEnum = pgEnum('leave_request_status', [
  'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED',
]);
export const holidayTypeEnum = pgEnum('holiday_type', [
  'NATIONAL', 'COMPANY', 'OPTIONAL',
]);
export const userRoleEnum = pgEnum('user_role', [
  'HR_ADMIN', 'MANAGER', 'EMPLOYEE',
]);

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  parentId: uuid('parent_id'),
  headId: uuid('head_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const designations = pgTable('designations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  grade: varchar('grade', { length: 50 }),
  level: integer('level').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeCode: varchar('employee_code', { length: 20 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 20 }),
  dob: date('dob'),
  gender: genderEnum('gender'),
  panNumber: text('pan_number'),
  aadhaarNumber: text('aadhaar_number'),
  bankAccount: text('bank_account'),
  bankIfsc: varchar('bank_ifsc', { length: 11 }),
  bankName: varchar('bank_name', { length: 100 }),
  departmentId: uuid('department_id').references(() => departments.id),
  designationId: uuid('designation_id').references(() => designations.id),
  managerId: uuid('manager_id'),
  grade: varchar('grade', { length: 50 }),
  costCentre: varchar('cost_centre', { length: 100 }),
  joiningDate: date('joining_date').notNull(),
  confirmationDate: date('confirmation_date'),
  separationDate: date('separation_date'),
  employmentType: employmentTypeEnum('employment_type').default('FULL_TIME'),
  workLocation: varchar('work_location', { length: 100 }),
  status: employeeStatusEnum('status').default('ACTIVE').notNull(),
  uanNumber: varchar('uan_number', { length: 12 }),
  esicIpNumber: varchar('esic_ip_number', { length: 17 }),
  emergencyContact: varchar('emergency_contact', { length: 20 }),
  maritalStatus: varchar('marital_status', { length: 20 }),
  probationDays: integer('probation_days'),
  bankAccountName: text('bank_account_name'),
  bankAccountType: varchar('bank_account_type', { length: 50 }),
  address: text('address'),
  priorExperienceMonths: integer('prior_experience_months'),
  shiftStartTime: varchar('shift_start_time', { length: 10 }),
  shiftEndTime: varchar('shift_end_time', { length: 10 }),
  photoUrl: text('photo_url'),
  isGeoExempt: boolean('is_geo_exempt').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx: index('employees_status_idx').on(t.status),
  deptIdx: index('employees_dept_idx').on(t.departmentId),
}));

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  graceMinutes: integer('grace_minutes').default(10),
  isNightShift: boolean('is_night_shift').default(false),
  weekOffs: jsonb('week_offs').default([0, 6]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const officeLocations = pgTable('office_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address'),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer('radius_meters').default(100),
  ipWhitelist: jsonb('ip_whitelist').default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const biometricDevices = pgTable('biometric_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  ipAddress: varchar('ip_address', { length: 50 }).notNull(),
  port: integer('port').default(4370).notNull(),
  deviceSerial: varchar('device_serial', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeBiometricIds = pgTable('employee_biometric_ids', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  deviceId: uuid('device_id').references(() => biometricDevices.id).notNull(),
  biometricUid: integer('biometric_uid').notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
}, (t) => ({
  deviceUidIdx: index('device_biometric_uid_idx').on(t.deviceId, t.biometricUid),
}));

export const attendanceLogs = pgTable('attendance_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  date: date('date').notNull(),
  punchIn: timestamp('punch_in'),
  punchOut: timestamp('punch_out'),
  workingHours: decimal('working_hours', { precision: 5, scale: 2 }),
  punchInLat: decimal('punch_in_lat', { precision: 10, scale: 7 }),
  punchInLng: decimal('punch_in_lng', { precision: 10, scale: 7 }),
  punchInIp: varchar('punch_in_ip', { length: 45 }),
  officeLocationId: uuid('office_location_id'),
  geoDistanceMeters: integer('geo_distance_meters'),
  status: attendanceStatusEnum('status').default('PRESENT'),
  isLate: boolean('is_late').default(false),
  lateByMinutes: integer('late_by_minutes').default(0),
  overtimeMinutes: integer('overtime_minutes').default(0),
  source: attendanceSourceEnum('source').default('WEB'),
  regularisedBy: uuid('regularised_by'),
  regularisedAt: timestamp('regularised_at'),
  remarks: text('remarks'),
}, (t) => ({
  dateIdx: index('attendance_date_idx').on(t.date),
  empDateIdx: index('attendance_emp_date_idx').on(t.employeeId, t.date),
}));

export const regularisationRequests = pgTable('regularisation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  date: date('date').notNull(),
  requestedIn: varchar('requested_in', { length: 5 }),
  requestedOut: varchar('requested_out', { length: 5 }),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('PENDING'),
  reviewedBy: uuid('reviewed_by'),
  reviewComment: text('review_comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  maxDaysPerYear: integer('max_days_per_year'),
  minNoticeDays: integer('min_notice_days').default(0),
  accrualPerMonth: decimal('accrual_per_month', { precision: 5, scale: 2 }).default('0'),
  carryForwardCap: integer('carry_forward_cap'),
  isPaid: boolean('is_paid').default(true),
  requiresApproval: boolean('requires_approval').default(true),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id).notNull(),
  year: integer('year').notNull(),
  balance: decimal('balance', { precision: 6, scale: 2 }).default('0'),
  consumed: decimal('consumed', { precision: 6, scale: 2 }).default('0'),
  tentative: decimal('tentative', { precision: 6, scale: 2 }).default('0'),
}, (t) => ({
  empYearIdx: index('leave_balances_emp_year_idx').on(t.employeeId, t.leaveTypeId, t.year),
}));

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isHalfDay: boolean('is_half_day').default(false),
  halfDaySession: varchar('half_day_session', { length: 2 }),
  daysCount: decimal('days_count', { precision: 5, scale: 2 }),
  reason: text('reason'),
  status: leaveRequestStatusEnum('status').default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by'),
  reviewComment: text('review_comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
}, (t) => ({
  empIdx: index('leave_requests_emp_idx').on(t.employeeId),
  statusIdx: index('leave_requests_status_idx').on(t.status),
  dateRangeIdx: index('leave_requests_date_range_idx').on(t.startDate, t.endDate),
}));

export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  type: holidayTypeEnum('type').default('NATIONAL'),
  state: varchar('state', { length: 50 }),
  isActive: boolean('is_active').default(true),
});

export const salaryStructures = pgTable('salary_structures', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  basicPct: decimal('basic_pct', { precision: 5, scale: 2 }).default('50'),
  hraPct: decimal('hra_pct', { precision: 5, scale: 2 }).default('20'),
  specialPct: decimal('special_pct', { precision: 5, scale: 2 }).default('30'),
  components: jsonb('components').default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeSalary = pgTable('employee_salary', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  structureId: uuid('structure_id').references(() => salaryStructures.id),
  gross: decimal('gross', { precision: 12, scale: 2 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  status: payrollRunStatusEnum('status').default('DRAFT').notNull(),
  totalGross: decimal('total_gross', { precision: 14, scale: 2 }),
  totalLop: decimal('total_lop', { precision: 14, scale: 2 }),
  totalNet: decimal('total_net', { precision: 14, scale: 2 }),
  totalPfEmployee: decimal('total_pf_employee', { precision: 14, scale: 2 }),
  totalPfEmployer: decimal('total_pf_employer', { precision: 14, scale: 2 }),
  totalEsicEmployee: decimal('total_esic_employee', { precision: 14, scale: 2 }),
  totalEsicEmployer: decimal('total_esic_employer', { precision: 14, scale: 2 }),
  totalPt: decimal('total_pt', { precision: 14, scale: 2 }),
  totalTds: decimal('total_tds', { precision: 14, scale: 2 }),
  lockedAt: timestamp('locked_at'),
  lockedBy: uuid('locked_by'),
  disbursedAt: timestamp('disbursed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payslips = pgTable('payslips', {
  id: uuid('id').primaryKey().defaultRandom(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  workingDays: integer('working_days'),
  presentDays: decimal('present_days', { precision: 5, scale: 2 }),
  lopDays: decimal('lop_days', { precision: 5, scale: 2 }),
  grossSalary: decimal('gross_salary', { precision: 12, scale: 2 }),
  earnedGross: decimal('earned_gross', { precision: 12, scale: 2 }),
  basic: decimal('basic', { precision: 12, scale: 2 }),
  hra: decimal('hra', { precision: 12, scale: 2 }),
  specialAllowance: decimal('special_allowance', { precision: 12, scale: 2 }),
  otherEarnings: jsonb('other_earnings').default([]),
  lopAmount: decimal('lop_amount', { precision: 12, scale: 2 }),
  pfEmployee: decimal('pf_employee', { precision: 12, scale: 2 }),
  pfEmployer: decimal('pf_employer', { precision: 12, scale: 2 }),
  esicEmployee: decimal('esic_employee', { precision: 12, scale: 2 }),
  esicEmployer: decimal('esic_employer', { precision: 12, scale: 2 }),
  professionalTax: decimal('professional_tax', { precision: 12, scale: 2 }),
  tds: decimal('tds', { precision: 12, scale: 2 }),
  otherDeductions: jsonb('other_deductions').default([]),
  totalDeductions: decimal('total_deductions', { precision: 12, scale: 2 }),
  netSalary: decimal('net_salary', { precision: 12, scale: 2 }),
  pdfUrl: text('pdf_url'),
  emailSentAt: timestamp('email_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  runIdx: index('payslips_run_idx').on(t.payrollRunId),
  empIdx: index('payslips_emp_idx').on(t.employeeId),
}));

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  docType: varchar('doc_type', { length: 50 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  uploadedBy: uuid('uploaded_by'),
  verifiedBy: uuid('verified_by'),
  verifiedAt: timestamp('verified_at'),
  expiryDate: date('expiry_date'),
  notes: text('notes'),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empIdx: index('documents_emp_idx').on(t.employeeId),
}));

export const employeeAuditLog = pgTable('employee_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  changeType: varchar('change_type', { length: 50 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedBy: uuid('changed_by'),
  changedByName: varchar('changed_by_name', { length: 200 }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('EMPLOYEE').notNull(),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empIdx: index('users_emp_idx').on(t.employeeId),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  platform: varchar('platform', { length: 10 }).default('expo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  linkPath: varchar('link_path', { length: 300 }),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  userEmail: varchar('user_email', { length: 200 }),
  userRole: varchar('user_role', { length: 30 }),
  action: varchar('action', { length: 100 }).notNull(),
  entity: varchar('entity', { length: 100 }),
  entityId: varchar('entity_id', { length: 100 }),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const letterTemplates = pgTable('letter_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  htmlBody: text('html_body').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const generatedLetters = pgTable('generated_letters', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  templateId: uuid('template_id').references(() => letterTemplates.id),
  type: varchar('type', { length: 50 }).notNull(),
  mergedHtml: text('merged_html').notNull(),
  generatedBy: uuid('generated_by').references(() => users.id).notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  assetCode: varchar('asset_code', { length: 50 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  purchaseDate: date('purchase_date'),
  purchaseValue: decimal('purchase_value', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 20 }).default('AVAILABLE').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assetAssignments = pgTable('asset_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  assignedAt: date('assigned_at').notNull(),
  returnedAt: date('returned_at'),
  condition: varchar('condition', { length: 50 }).default('GOOD'),
  remarks: text('remarks'),
  assignedBy: uuid('assigned_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenseClaims = pgTable('expense_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
  submittedAt: timestamp('submitted_at'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  remarks: text('remarks'),
  reimbursedAt: timestamp('reimbursed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const expenseItems = pgTable('expense_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimId: uuid('claim_id').references(() => expenseClaims.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: varchar('description', { length: 300 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const grievances = pgTable('grievances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  description: text('description').notNull(),
  priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const grievanceComments = pgTable('grievance_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  grievanceId: uuid('grievance_id').references(() => grievances.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  comment: text('comment').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const helpTickets = pgTable('help_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: varchar('ticket_number', { length: 20 }).notNull().unique(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  description: text('description').notNull(),
  priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const helpTicketComments = pgTable('help_ticket_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').references(() => helpTickets.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  comment: text('comment').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveys = pgTable('surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).default('NAMED').notNull(),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
  deadline: date('deadline'),
  targetRole: varchar('target_role', { length: 20 }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const surveyQuestions = pgTable('survey_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id').references(() => surveys.id).notNull(),
  questionText: text('question_text').notNull(),
  questionType: varchar('question_type', { length: 30 }).notNull(),
  options: jsonb('options').default([]).notNull(),
  required: boolean('required').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id').references(() => surveys.id).notNull(),
  respondentId: uuid('respondent_id').references(() => employees.id),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const surveyAnswers = pgTable('survey_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  responseId: uuid('response_id').references(() => surveyResponses.id).notNull(),
  questionId: uuid('question_id').references(() => surveyQuestions.id).notNull(),
  answerText: text('answer_text'),
  answerRating: integer('answer_rating'),
  answerChoice: varchar('answer_choice', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobPostings = pgTable('job_postings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  designationId: uuid('designation_id').references(() => designations.id),
  jobType: varchar('job_type', { length: 30 }).default('FULL_TIME').notNull(),
  location: varchar('location', { length: 200 }),
  description: text('description'),
  requirements: text('requirements'),
  openings: integer('openings').default(1).notNull(),
  status: varchar('status', { length: 20 }).default('OPEN').notNull(),
  closingDate: date('closing_date'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobApplications = pgTable('job_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobPostings.id).notNull(),
  applicantName: varchar('applicant_name', { length: 200 }).notNull(),
  email: varchar('email', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  resumeUrl: text('resume_url'),
  currentCompany: varchar('current_company', { length: 200 }),
  currentRole: varchar('current_role', { length: 200 }),
  totalExperience: varchar('total_experience', { length: 50 }),
  noticePeriod: varchar('notice_period', { length: 50 }),
  expectedSalary: varchar('expected_salary', { length: 100 }),
  stage: varchar('stage', { length: 30 }).default('APPLIED').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  notes: text('notes'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interviewSchedules = pgTable('interview_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').references(() => jobApplications.id).notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  durationMinutes: integer('duration_minutes').default(60).notNull(),
  mode: varchar('mode', { length: 30 }).default('VIDEO').notNull(),
  location: varchar('location', { length: 200 }),
  interviewers: jsonb('interviewers').default([]).notNull(),
  notes: text('notes'),
  outcome: varchar('outcome', { length: 30 }),
  feedback: text('feedback'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const appraisalCycles = pgTable('appraisal_cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const appraisalSubmissions = pgTable('appraisal_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').references(() => appraisalCycles.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  goals: jsonb('goals').default([]).notNull(),
  selfRating: integer('self_rating'),
  selfComments: text('self_comments'),
  managerRating: integer('manager_rating'),
  managerComments: text('manager_comments'),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(),
  selfSubmittedAt: timestamp('self_submitted_at'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const trainingPrograms = pgTable('training_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).default('TECHNICAL').notNull(),
  description: text('description'),
  trainer: varchar('trainer', { length: 200 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  maxCapacity: integer('max_capacity'),
  status: varchar('status', { length: 20 }).default('UPCOMING').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const trainingEnrollments = pgTable('training_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').references(() => trainingPrograms.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: varchar('status', { length: 20 }).default('ENROLLED').notNull(),
  enrolledBy: uuid('enrolled_by').references(() => users.id).notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  clientName: varchar('client_name', { length: 200 }),
  description: text('description'),
  billable: boolean('billable').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const timesheetEntries = pgTable('timesheet_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  entryDate: date('entry_date').notNull(),
  weekStart: date('week_start').notNull(),
  hours: decimal('hours', { precision: 4, scale: 2 }).notNull(),
  taskDescription: varchar('task_description', { length: 500 }),
  billable: boolean('billable').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
  submittedAt: timestamp('submitted_at'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vaultFolders = pgTable('vault_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 10 }),
  targetType: varchar('target_type', { length: 20 }).default('ALL').notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  targetRole: varchar('target_role', { length: 30 }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vaultDocuments = pgTable('vault_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  folderId: uuid('folder_id').references(() => vaultFolders.id).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  fileType: varchar('file_type', { length: 100 }),
  version: integer('version').default(1).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  targetType: varchar('target_type', { length: 20 }).default('ALL').notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  isPinned: boolean('is_pinned').default(false).notNull(),
  expiresAt: timestamp('expires_at'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customFields = pgTable('custom_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 100 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  fieldType: varchar('field_type', { length: 50 }).notNull(),
  options: jsonb('options').default('[]'),
  required: boolean('required').default(false).notNull(),
  position: varchar('position', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customFieldValues = pgTable('custom_field_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id').notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  value: text('value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowStates = pgTable('workflow_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  stateName: varchar('state_name', { length: 100 }).notNull(),
  style: varchar('style', { length: 50 }).default('blue').notNull(),
  isInitial: boolean('is_initial').default(false).notNull(),
  isFinal: boolean('is_final').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowTransitions = pgTable('workflow_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  fromState: varchar('from_state', { length: 100 }).notNull(),
  toState: varchar('to_state', { length: 100 }).notNull(),
  actionLabel: varchar('action_label', { length: 100 }).notNull(),
  allowedRoles: jsonb('allowed_roles').default('[]').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowLogs = pgTable('workflow_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id').notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  transitionedBy: uuid('transitioned_by').references(() => users.id),
  transitionedAt: timestamp('transitioned_at').defaultNow().notNull(),
  comment: text('comment'),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: varchar('role', { length: 50 }).notNull(),
  module: varchar('module', { length: 100 }).notNull(),
  canRead: boolean('can_read').default(true).notNull(),
  canWrite: boolean('can_write').default(false).notNull(),
  canCreate: boolean('can_create').default(false).notNull(),
  canDelete: boolean('can_delete').default(false).notNull(),
  canSubmit: boolean('can_submit').default(false).notNull(),
  canCancel: boolean('can_cancel').default(false).notNull(),
  canExport: boolean('can_export').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const versions = pgTable('versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 100 }).notNull(),
  recordId: uuid('record_id').notNull(),
  dataBefore: jsonb('data_before'),
  dataAfter: jsonb('data_after'),
  changedBy: uuid('changed_by').references(() => users.id),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

export const printFormats = pgTable('print_formats', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 100 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  htmlTemplate: text('html_template').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationRules = pgTable('notification_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 100 }).notNull(),
  event: varchar('event', { length: 50 }).notNull(), // 'on_create', 'on_update', 'on_submit'
  condition: text('condition'),
  recipients: jsonb('recipients').default('[]').notNull(),
  emailTemplateId: uuid('email_template_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull().unique(),
  subject: varchar('subject', { length: 300 }).notNull(),
  htmlBody: text('html_body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailAlertRules = pgTable('email_alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  doctype: varchar('doctype', { length: 100 }).notNull(),
  event: varchar('event', { length: 50 }).notNull(), // onCreate, onSave, onSubmit, onStatusChange
  condition: text('condition'),
  recipients: jsonb('recipients').default('[]').notNull(),
  subjectTemplate: varchar('subject_template', { length: 300 }).notNull(),
  bodyTemplate: text('body_template').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedReports = pgTable('saved_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // QUERY, SCRIPT
  doctype: varchar('doctype', { length: 100 }).notNull(),
  queryOrScript: text('query_or_script').notNull(),
  columns: jsonb('columns').default('[]').notNull(),
  filters: jsonb('filters').default('[]').notNull(),
  isStandard: boolean('is_standard').default(false).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
