import { configureStore } from "@reduxjs/toolkit";

import employeeReducer from "../features/employees/employeeSlice";
import departmentReducer from "../features/departments/departmentSlice";
import designationReducer from "../features/designations/designationSlice";
import attendanceReducer from "../features/attendance/attendanceSlice";
import rosterReducer from "../features/roster/rosterSlice";
import dailyAttendanceReducer from "../features/dailyAttendance/dailyAttendanceSlice";
import monthlyAttendanceReducer from "../features/dailyAttendance/monthlyAttendanceSlice";
import authReducer from "../features/auth/authSlice";
import companyReducer from "../features/company/companySlice";
import payrollReducer from "../features/payroll/payrollSlice";

export const store = configureStore({
  reducer: {
    employees: employeeReducer,
    departments: departmentReducer,
    designations: designationReducer,
    attendance: attendanceReducer,
    roster: rosterReducer,
    dailyAttendance: dailyAttendanceReducer,
    monthlyAttendance: monthlyAttendanceReducer,
    auth: authReducer,
    company: companyReducer,
    payroll: payrollReducer,
  },
});
