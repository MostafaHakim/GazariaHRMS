# Phase 8 Changelog

- Added idempotent payroll-generated PaymentRecord upserts.
- Added unique partial index for company + payrollRun + employee.
- Added payroll status transition audit events.
- Fixed PaymentHistory page role selector runtime error.
- Remount route content on active-company switch to refresh data.
- Added company validation for manual payment employee references.
- Added Expense update validation and group-level audit visibility for Group Admin.
- Fixed Phase 7 index script import paths and npm script target.
- Added pure Node.js unit tests for payroll payment mapping.
