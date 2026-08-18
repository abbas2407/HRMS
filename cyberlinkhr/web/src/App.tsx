import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useVendorAuthStore } from '@/stores/vendor-auth.store';
import AppShell from '@/components/layout/AppShell';
import LoginPage from '@/apps/company/LoginPage';
import DashboardPage from '@/apps/company/DashboardPage';
import EmployeeListPage from '@/apps/company/employees/EmployeeListPage';
import EmployeeProfilePage from '@/apps/company/employees/EmployeeProfilePage';
import DepartmentsPage from '@/apps/company/departments/DepartmentsPage';
import DesignationsPage from '@/apps/company/designations/DesignationsPage';
import ShiftsPage from '@/apps/company/shifts/ShiftsPage';
import BiometricDevicesPage from '@/apps/company/biometric/BiometricDevicesPage';
import PunchPage from '@/apps/company/attendance/PunchPage';
import AttendancePage from '@/apps/company/attendance/AttendancePage';
import MyAttendancePage from '@/apps/company/attendance/MyAttendancePage';
import LiveBoardPage from '@/apps/company/attendance/LiveBoardPage';
import RegularisationPage from '@/apps/company/regularisation/RegularisationPage';
import OfficeLocationsPage from '@/apps/company/settings/OfficeLocationsPage';
import LeaveRequestsPage from '@/apps/company/leave/LeaveRequestsPage';
import LeaveBalancePage from '@/apps/company/leave/LeaveBalancePage';
import LeaveTypesPage from '@/apps/company/leave/LeaveTypesPage';
import HolidayCalendarPage from '@/apps/company/leave/HolidayCalendarPage';
import PayrollRunsPage from '@/apps/company/payroll/PayrollRunsPage';
import PayrollRunDetailPage from '@/apps/company/payroll/PayrollRunDetailPage';
import PayslipPage from '@/apps/company/payroll/PayslipPage';
import MyPayslipsPage from '@/apps/company/payroll/MyPayslipsPage';
import SalaryStructurePage from '@/apps/company/payroll/SalaryStructurePage';
import CompliancePage from '@/apps/company/compliance/CompliancePage';
import ReportsPage from '@/apps/company/reports/ReportsPage';
import CompanySettingsPage from '@/apps/company/settings/CompanySettingsPage';
import MyProfilePage from '@/apps/company/profile/MyProfilePage';
import OnboardingPage from '@/apps/company/onboarding/OnboardingPage';
import SeparationPage from '@/apps/company/separation/SeparationPage';
import AnnouncementsPage from '@/apps/company/announcements/AnnouncementsPage';
import OrgChartPage from '@/apps/company/org-chart/OrgChartPage';
import LettersPage from '@/apps/company/letters/LettersPage';
import AssetsPage from '@/apps/company/assets/AssetsPage';
import PerformancePage from '@/apps/company/performance/PerformancePage';
import TrainingPage from '@/apps/company/training/TrainingPage';
import ExpensesPage from '@/apps/company/expenses/ExpensesPage';
import GrievancesPage from '@/apps/company/grievances/GrievancesPage';
import RecruitmentPage from '@/apps/company/recruitment/RecruitmentPage';
import SurveysPage from '@/apps/company/surveys/SurveysPage';
import HelpdeskPage from '@/apps/company/helpdesk/HelpdeskPage';
import NotificationsPage from '@/apps/company/notifications/NotificationsPage';
import AuditLogPage from '@/apps/company/audit/AuditLogPage';
import TimesheetPage from '@/apps/company/timesheet/TimesheetPage';
import VaultPage from '@/apps/company/vault/VaultPage';
import GeoFencePage from '@/apps/company/geo-fence/GeoFencePage';
import VendorLayout from '@/apps/vendor/VendorLayout';
import VendorLoginPage from '@/apps/vendor/VendorLoginPage';
import VendorDashboard from '@/apps/vendor/VendorDashboard';
import VendorCompanies from '@/apps/vendor/VendorCompanies';
import VendorCompanyDetail from '@/apps/vendor/VendorCompanyDetail';
import VendorExpiryTracker from '@/apps/vendor/VendorExpiryTracker';
import VendorBillingPage from '@/apps/vendor/VendorBillingPage';
import VendorAuditLog from '@/apps/vendor/VendorAuditLog';
import VendorSettingsPage from '@/apps/vendor/VendorSettingsPage';
import VendorAnnouncementsPage from '@/apps/vendor/VendorAnnouncementsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function VendorGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useVendorAuthStore();
  if (!isAuthenticated) return <Navigate to="/vendor/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Company login */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Vendor panel */}
      <Route path="/vendor/login" element={<VendorLoginPage />} />
      <Route
        path="/vendor"
        element={<VendorGuard><VendorLayout /></VendorGuard>}
      >
        <Route index element={<Navigate to="/vendor/dashboard" replace />} />
        <Route path="dashboard" element={<VendorDashboard />} />
        <Route path="companies" element={<VendorCompanies />} />
        <Route path="companies/:id" element={<VendorCompanyDetail />} />
        <Route path="expiring" element={<VendorExpiryTracker />} />
        <Route path="billing" element={<VendorBillingPage />} />
        <Route path="audit-log" element={<VendorAuditLog />} />
        <Route path="settings" element={<VendorSettingsPage />} />
        <Route path="announcements" element={<VendorAnnouncementsPage />} />
      </Route>

      {/* Company app */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeeListPage />} />
        <Route path="/employees/:id" element={<EmployeeProfilePage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/designations" element={<DesignationsPage />} />
        {/* Attendance & Shifts */}
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/biometric" element={<BiometricDevicesPage />} />
        <Route path="/attendance/punch" element={<PunchPage />} />
        <Route path="/attendance/register" element={<AttendancePage />} />
        <Route path="/attendance/my" element={<MyAttendancePage />} />
        <Route path="/attendance/live" element={<LiveBoardPage />} />
        <Route path="/regularisation" element={<RegularisationPage />} />
        <Route path="/settings/office-locations" element={<OfficeLocationsPage />} />
        {/* Leave */}
        <Route path="/leaves" element={<LeaveRequestsPage />} />
        <Route path="/leave-balance" element={<LeaveBalancePage />} />
        <Route path="/leave-types" element={<LeaveTypesPage />} />
        <Route path="/holidays" element={<HolidayCalendarPage />} />
        {/* Payroll */}
        <Route path="/payroll" element={<PayrollRunsPage />} />
        <Route path="/payroll/:id" element={<PayrollRunDetailPage />} />
        <Route path="/payroll/payslip/:id" element={<PayslipPage />} />
        <Route path="/payslips" element={<MyPayslipsPage />} />
        <Route path="/salary-structure" element={<SalaryStructurePage />} />
        {/* Compliance */}
        <Route path="/compliance/pf" element={<CompliancePage />} />
        <Route path="/compliance/esic" element={<CompliancePage />} />
        <Route path="/compliance/tds" element={<CompliancePage />} />
        <Route path="/compliance/pt" element={<CompliancePage />} />
        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />
        {/* Phase 8 */}
        <Route path="/settings" element={<CompanySettingsPage />} />
        <Route path="/profile" element={<MyProfilePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/separation" element={<SeparationPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/org-chart" element={<OrgChartPage />} />
        <Route path="/letters" element={<LettersPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/grievances" element={<GrievancesPage />} />
        <Route path="/recruitment" element={<RecruitmentPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/helpdesk" element={<HelpdeskPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/timesheet" element={<TimesheetPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/geo-fence" element={<GeoFencePage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
