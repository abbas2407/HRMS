import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectRedis } from './shared/utils/redis';
import { generalRateLimit } from './shared/middleware/rateLimit';
import { startExpiryCheck } from './shared/jobs/expiry-check';
import { startRenewalReminders } from './shared/jobs/renewal-reminders';
import { startExpiryAlerts } from './shared/jobs/expiry-alerts';
import { startAutoAbsent } from './shared/jobs/auto-absent';
import { setIO } from './shared/utils/socket';

// Routers
import companyAuthRouter from './company/auth/auth.router';
import departmentsRouter from './company/departments/departments.router';
import designationsRouter from './company/designations/designations.router';
import employeesRouter from './company/employees/employees.router';
import documentsRouter from './company/documents/documents.router';
import shiftsRouter from './company/shifts/shifts.router';
import attendanceRouter from './company/attendance/attendance.router';
import regularisationRouter from './company/regularisation/regularisation.router';
import officeLocationsRouter from './company/office-locations/office-locations.router';
import leaveRouter from './company/leave/leave.router';
import { startLeaveAccrual } from './shared/jobs/leave-accrual';
import payrollRouter from './company/payroll/payroll.router';
import complianceRouter from './company/compliance/compliance.router';
import reportsRouter from './company/reports/reports.router';
import settingsRouter from './company/settings/settings.router';
import dashboardRouter from './company/dashboard/dashboard.router';
import devicesRouter from './company/devices/devices.router';
import announcementsRouter from './company/announcements/announcements.router';
import orgChartRouter from './company/org-chart/org-chart.router';
import lettersRouter from './company/letters/letters.router';
import assetsRouter from './company/assets/assets.router';
import performanceRouter from './company/performance/performance.router';
import trainingRouter from './company/training/training.router';
import expensesRouter from './company/expenses/expenses.router';
import grievancesRouter from './company/grievances/grievances.router';
import recruitmentRouter from './company/recruitment/recruitment.router';
import surveysRouter from './company/surveys/surveys.router';
import helpdeskRouter from './company/helpdesk/helpdesk.router';
import notificationsRouter from './company/notifications/notifications.router';
import searchRouter from './company/search/search.router';
import timesheetRouter from './company/timesheet/timesheet.router';
import vaultRouter from './company/vault/vault.router';
import vendorAuthRouter from './vendor/auth/vendor-auth.router';
import vendorTenantsRouter from './vendor/tenants/vendor-tenants.router';
import vendorBillingRouter from './vendor/billing/vendor-billing.router';

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.APP_URL || 'http://localhost:3000',
    ],
    credentials: true,
  },
  path: '/socket.io',
});

setIO(io);

io.on('connection', (socket) => {
  socket.on('join-tenant', (schemaName: string) => {
    socket.join(`tenant:${schemaName}`);
  });
  socket.on('leave-tenant', (schemaName: string) => {
    socket.leave(`tenant:${schemaName}`);
  });
});

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.APP_URL || 'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(generalRateLimit);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Auth routes (no tenant needed)
app.use('/api/auth', companyAuthRouter);

// Company HR routes
app.use('/api/departments', departmentsRouter);
app.use('/api/designations', designationsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/regularisation', regularisationRouter);
app.use('/api/office-locations', officeLocationsRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/org-chart', orgChartRouter);
app.use('/api/letters', lettersRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/training', trainingRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/grievances', grievancesRouter);
app.use('/api/recruitment', recruitmentRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/helpdesk', helpdeskRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/timesheet', timesheetRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/search', searchRouter);

// Vendor routes (separate JWT, no tenant middleware)
app.use('/api/vendor/auth', vendorAuthRouter);
app.use('/api/vendor', vendorTenantsRouter);
app.use('/api/vendor/billing', vendorBillingRouter);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectRedis();
  startExpiryCheck();
  startRenewalReminders();
  startExpiryAlerts();
  startAutoAbsent();
  startLeaveAccrual();
  httpServer.listen(PORT, () => {
    console.log(`CyberlinkHR API running on port ${PORT}`);
  });
}

start().catch(console.error);

export { app, httpServer };
