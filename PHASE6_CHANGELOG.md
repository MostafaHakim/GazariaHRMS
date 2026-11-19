# Phase 6 Changelog

- Added company reference to PayrollRun, PayrollLine and AdvanceLoan.
- Changed payroll uniqueness to company + month.
- Scoped payroll generation, attendance/shift lookups, line editing, status changes and export to selected company.
- Scoped Advance/Loan CRUD, approval, schedule deduction, conflict detection and draft refresh to selected company.
- Added requireCompany middleware to payroll and advances routes.
- Added Group Admin read-only consolidated payroll summary API and UI.
- Added Phase 6 index preparation script and npm command.
- Preserved payroll calculation service and existing salary calculation rules.
