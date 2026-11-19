import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  X,
  RefreshCw,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import { fetchDepartments } from "../features/departments/departmentSlice";
import {
  clearEmployees,
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkCreateEmployees,
} from "../features/employees/employeeSlice";

import EmployeeForm from "../components/employees/EmployeeForm";

const Employees = () => {
  const dispatch = useAppDispatch();

  const { employees, loading, error, total, stats, pagination, sections } =
    useAppSelector((state) => state.employees);
  const { departments } = useAppSelector((state) => state.departments);
  const { companies, activeCompanyId } = useAppSelector(
    (state) => state.company,
  );
  const activeCompany = companies.find(
    (company) => String(company._id) === String(activeCompanyId),
  );

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [saving, setSaving] = useState(false);

  // Bulk import states
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [parsedEmployees, setParsedEmployees] = useState([]);
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef(null);

  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const PAGE_SIZE = 100;

  const loadEmployees = () => {
    if (!activeCompanyId) return;
    dispatch(
      fetchEmployees({
        page,
        limit: PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(departmentFilter ? { department: departmentFilter } : {}),
        ...(sectionFilter ? { section: sectionFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    );
  };

  useEffect(() => {
    dispatch(fetchDepartments());
  }, [dispatch]);

  // সার্চ বদলালে ০.৪ সেকেন্ড পর সার্ভার থেকে খোঁজা হবে; পেজ বদলালে সাথে সাথে
  useEffect(() => {
    dispatch(clearEmployees());
    if (!activeCompanyId) return undefined;
    const timer = setTimeout(loadEmployees, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [
    dispatch,
    activeCompanyId,
    page,
    search,
    departmentFilter,
    sectionFilter,
    statusFilter,
  ]);

  // সার্ভার ফিল্টার করে পাঠায়, তাই এখানে আর আলাদা ফিল্টার নেই
  const filteredEmployees = employees;

  const openAddModal = () => {
    setSelectedEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);

    try {
      if (selectedEmployee) {
        await dispatch(
          updateEmployee({
            id: selectedEmployee._id,
            data: payload,
          }),
        ).unwrap();
      } else {
        await dispatch(createEmployee(payload)).unwrap();
      }

      closeModal();
      loadEmployees();
    } catch (err) {
      alert(typeof err === "string" ? err : "Unable to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (employee) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.name}?`,
    );

    if (!confirmed) return;

    try {
      await dispatch(deleteEmployee(employee._id)).unwrap();
      loadEmployees();
    } catch (err) {
      alert(typeof err === "string" ? err : "Unable to delete employee");
    }
  };

  // ---------- Bulk Import Helpers ----------
  const downloadTemplate = () => {
    const headers = [
      "employeeId",
      "name",
      "nameBangla",
      "fatherName",
      "motherName",
      "gender",
      "religion",
      "dateOfBirth",
      "phone",
      "email",
      "presentAddress",
      "permanentAddress",
      "section",
      "joiningDate",
      "employmentType",
      "employmentStatus",
      "bloodGroup",
      "nidNumber",
      "grossSalary",
      "basicSalary",
      "paymentMethod",
      "paymentAccount",
      "remarks",
      "deviceId",
      "deviceUserId",
    ];

    const sample = [
      "EMP001",
      "John Doe",
      "",
      "Father Name",
      "Mother Name",
      "Male",
      "Muslim",
      "1990-01-15",
      "01700000000",
      "john@example.com",
      "Present Address",
      "Permanent Address",
      "Section A",
      "2024-01-01",
      "Probation",
      "Active",
      "B+",
      "1234567890",
      "25000",
      "15000",
      "Bkash",
      "01722440899",
      "",
      "K40-01",
      "1",
    ];

    const csvContent =
      headers.join(",") + "\n" + sample.map((v) => `"${v}"`).join(",");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_bulk_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const parseRow = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, ""),
    );

    const required = ["employeeid", "name", "joiningdate"];
    for (const r of required) {
      if (!headers.includes(r)) {
        throw new Error(
          `Missing required column: ${r}. Please use the template.`,
        );
      }
    }

    const parseSalary = (value) => {
      if (!value || !value.trim()) return 0;

      const cleanedValue = String(value)
        .replace(/,/g, "")
        .replace(/[৳\s]/g, "")
        .replace(/BDT/gi, "")
        .trim();

      const amount = Number(cleanedValue);

      return Number.isFinite(amount) ? amount : 0;
    };

    const employees = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      if (values.every((v) => !v)) continue;

      const obj = {};
      headers.forEach((header, idx) => {
        const value = values[idx] ?? "";
        // Map common header variants
        if (header === "employeeid") obj.employeeId = value;
        else if (header === "name") obj.name = value;
        else if (header === "namebangla") obj.nameBangla = value;
        else if (header === "fathername") obj.fatherName = value;
        else if (header === "mothername") obj.motherName = value;
        else if (header === "gender") obj.gender = value || "Male";
        else if (header === "religion") obj.religion = value || "Other";
        else if (header === "dateofbirth") obj.dateOfBirth = value || null;
        else if (header === "phone") obj.phone = value;
        else if (header === "email") obj.email = value;
        else if (header === "presentaddress") obj.presentAddress = value;
        else if (header === "permanentaddress") obj.permanentAddress = value;
        else if (header === "section") obj.section = value;
        else if (header === "joiningdate") obj.joiningDate = value;
        else if (header === "employmenttype") obj.employmentType = value;
        else if (header === "employmentstatus")
          obj.employmentStatus = value || "Active";
        else if (header === "bloodgroup") obj.bloodGroup = value;
        else if (header === "nidnumber") obj.nidNumber = value;
        else if (header === "grosssalary") obj.grossSalary = parseSalary(value);
        else if (header === "basicsalary") obj.basicSalary = parseSalary(value);
        else if (header === "paymentmethod") obj.paymentMethod = value;
        else if (header === "paymentaccount") obj.paymentAccount = value;
        else if (header === "remarks") obj.remarks = value;
        else if (header === "deviceid") obj._deviceId = value;
        else if (header === "deviceuserid") obj._deviceUserId = value;
      });

      if (obj._deviceId && obj._deviceUserId) {
        obj.deviceMappings = [
          {
            deviceId: obj._deviceId,
            deviceUserId: String(obj._deviceUserId),
          },
        ];
      }
      delete obj._deviceId;
      delete obj._deviceUserId;

      employees.push(obj);
    }

    return employees;
  };

  const handleFileChange = (e) => {
    setParseError("");
    setParsedEmployees([]);
    setBulkResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const employees = parseCSV(text);
        if (employees.length === 0) {
          setParseError("No valid employee rows found in the CSV");
          return;
        }
        setParsedEmployees(employees);
      } catch (err) {
        setParseError(err.message || "Failed to parse CSV");
      }
    };
    reader.onerror = () => setParseError("Failed to read file");
    reader.readAsText(file, "UTF-8");
  };

  const handleBulkImport = async () => {
    if (parsedEmployees.length === 0) return;

    setBulkSaving(true);
    setBulkResult(null);

    try {
      const data = await dispatch(
        bulkCreateEmployees(parsedEmployees),
      ).unwrap();

      setBulkResult(data.results);
      loadEmployees();
    } catch (err) {
      setParseError(typeof err === "string" ? err : "Bulk import failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const closeBulkModal = () => {
    setBulkModalOpen(false);
    setParsedEmployees([]);
    setParseError("");
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Employee Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage employee records and employment information
          </p>
          <p className="mt-1 inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            Company:{" "}
            {activeCompany?.name || "Select a company from the top bar"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={!activeCompanyId}
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <Upload size={18} />
            Bulk Import
          </button>

          <button
            disabled={!activeCompanyId}
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {!activeCompanyId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Please select an authorized company from the top bar before managing
          employees.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Employees</p>
              <h2 className="text-2xl font-bold text-slate-800">
                {total ?? employees.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Active Employees</p>
          <h2 className="mt-2 text-2xl font-bold text-emerald-700">
            {stats?.active ?? 0}
          </h2>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Inactive Employees</p>
          <h2 className="mt-2 text-2xl font-bold text-red-600">
            {stats?.inactive ?? 0}
          </h2>
        </div>
      </div>

      {/* Employee Table */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID, name, phone, section..."
              className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setSectionFilter("");
              setPage(1);
            }}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">All Departments</option>
            {(departments || []).map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={sectionFilter}
            onChange={(e) => {
              setSectionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">All Sections</option>
            {(sections || []).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            <option value="__NONE__">No Section</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Resigned">Resigned</option>
            <option value="Terminated">Terminated</option>
          </select>

          {(departmentFilter || sectionFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setDepartmentFilter("");
                setSectionFilter("");
                setStatusFilter("");
                setSearch("");
                setPage(1);
              }}
              className="rounded-lg border px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              Clear
            </button>
          )}

          <button
            onClick={loadEmployees}
            className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">SL</th>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Department</th>
                <th className="p-3">Designation</th>
                <th className="p-3">Section</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    Loading employees...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee, index) => (
                  <tr key={employee._id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{index + 1}</td>

                    <td className="p-3 font-medium text-slate-700">
                      {employee.employeeId}
                    </td>

                    <td className="p-3 font-medium">
                      <div className="flex flex-col">
                        <span>{employee.name}</span>
                        {(!employee.deviceMappings ||
                          employee.deviceMappings.length === 0) && (
                          <span className="mt-0.5 text-[11px] font-normal text-amber-600">
                            ⚠ No device mapping
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">{employee.department?.name || "-"}</td>

                    <td className="p-3">{employee.designation?.name || "-"}</td>

                    <td className="p-3">{employee.section || "-"}</td>

                    <td className="p-3">{employee.phone || "-"}</td>

                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          employee.employmentStatus === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {employee.employmentStatus}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(employee)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          title="Edit Employee"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(employee)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          title="Delete Employee"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t pt-3 text-sm text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Showing {filteredEmployees.length} of {total} employee(s)
              {pagination?.totalPages > 1 &&
                ` — Page ${pagination.page} of ${pagination.totalPages}`}
            </span>

            {pagination?.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-4xl rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {selectedEmployee
                    ? "Edit Employee"
                    : "New Employee Registration"}
                </h2>
                <p className="text-xs text-slate-500">
                  Enter employee information carefully
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <EmployeeForm
                employee={selectedEmployee}
                onClose={closeModal}
                onSubmit={handleSubmit}
                submitting={saving}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Bulk Employee Import
                </h2>
                <p className="text-xs text-slate-500">
                  Upload a CSV file to add multiple employees at once
                </p>
              </div>

              <button
                onClick={closeBulkModal}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Template Download */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-emerald-600" size={22} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Download CSV Template
                    </p>
                    <p className="text-xs text-slate-500">
                      Use this template to prepare your employee data
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <Download size={16} />
                  Template
                </button>
              </div>

              {/* File Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select CSV File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              {parseError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {parseError}
                </div>
              )}

              {/* Preview */}
              {parsedEmployees.length > 0 && !bulkResult && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Preview ({parsedEmployees.length} employees)
                  </p>
                  <div className="max-h-48 overflow-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Employee ID</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Joining Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedEmployees.slice(0, 50).map((emp, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{idx + 1}</td>
                            <td className="p-2">{emp.employeeId}</td>
                            <td className="p-2">{emp.name}</td>
                            <td className="p-2">{emp.phone || "-"}</td>
                            <td className="p-2">{emp.joiningDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedEmployees.length > 50 && (
                      <p className="p-2 text-center text-xs text-slate-500">
                        ... and {parsedEmployees.length - 50} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Result */}
              {bulkResult && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-medium">
                      Import completed: {bulkResult.success.length} created,{" "}
                      {bulkResult.failed.length} failed (out of{" "}
                      {bulkResult.total})
                    </p>
                  </div>

                  {bulkResult.failed.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-red-700">
                        Failed rows:
                      </p>
                      <div className="max-h-40 overflow-auto rounded-lg border border-red-100">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-red-50">
                            <tr>
                              <th className="p-2">Row</th>
                              <th className="p-2">Employee ID</th>
                              <th className="p-2">Name</th>
                              <th className="p-2">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResult.failed.map((f, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{f.row}</td>
                                <td className="p-2">{f.employeeId}</td>
                                <td className="p-2">{f.name}</td>
                                <td className="p-2 text-red-600">{f.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={closeBulkModal}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Close
                </button>

                {!bulkResult && (
                  <button
                    onClick={handleBulkImport}
                    disabled={parsedEmployees.length === 0 || bulkSaving}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkSaving ? (
                      "Importing..."
                    ) : (
                      <>
                        <Upload size={16} />
                        Import {parsedEmployees.length || ""} Employees
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
