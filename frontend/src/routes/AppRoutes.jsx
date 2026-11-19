import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "../components/layout/AdminLayout";

import Dashboard from "../pages/Dashboard";
import Employees from "../pages/AllEmployees";
import Departments from "../pages/Departments";
import Designations from "../pages/Designations";
import Attendance from "../pages/Attendance";
import WeeklyRoster from "../pages/WeeklyRoster";
import RosterPlan from "../pages/RosterPlan";
import Shifts from "../pages/Shifts";
import Devices from "../pages/Devices";
import DailyAttendance from "../pages/DailyAttendance";
import MonthlyAttendance from "../pages/MonthlyAttendance";
import Holidays from "../pages/Holidays";
import JobCard from "../pages/JobCard";
import Reports from "../pages/Reports";
import Leaves from "../pages/Leaves";
import Payroll from "../pages/Payroll";
import AdvanceLoans from "../pages/AdvanceLoans";
import Users from "../pages/Users";
import GroupDashboard from "../pages/GroupDashboard";
import Expenses from "../pages/finance/Expenses";
import PaymentHistory from "../pages/finance/PaymentHistory";
import AuditLogs from "../pages/finance/AuditLogs";
import CompanyAccess from "../pages/finance/CompanyAccess";
import Companies from "../pages/Companies";
import Login from "../pages/Login";
import ProtectedRoute from "../components/auth/ProtectedRoute";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/designations" element={<Designations />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/weekly-roster" element={<WeeklyRoster />} />
          <Route path="/shifts" element={<Shifts />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/roster-plan" element={<RosterPlan />} />
          <Route path="/shift-groups" element={<Navigate to="/roster-plan" replace />} />
          <Route path="/shift-rotation" element={<Navigate to="/roster-plan" replace />} />
          <Route path="/daily-attendance" element={<DailyAttendance />} />
          <Route path="/monthly-attendance" element={<MonthlyAttendance />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/job-card" element={<JobCard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/advances" element={<AdvanceLoans />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/payment-history" element={<PaymentHistory />} />

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/users" element={<Users />} />
            <Route path="/group-dashboard" element={<GroupDashboard />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/company-access" element={<CompanyAccess />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
