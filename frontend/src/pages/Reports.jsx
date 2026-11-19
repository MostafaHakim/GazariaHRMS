import { useEffect, useState } from "react";
import {
  FileBarChart,
  Download,
  Search,
  Clock,
  Building2,
  AlertTriangle,
} from "lucide-react";
import api from "../services/api";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { fetchDepartments } from "../features/departments/departmentSlice";

const formatDuration = (minutes = 0) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const formatTime = (date) => {
  if (!date) return "--";
  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const downloadCSV = (filename, headers, rows) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const getToday = () => {
  const now = new Date();
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return bd.toISOString().slice(0, 10);
};

const getCurrentMonth = () => {
  const now = new Date();
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return bd.toISOString().slice(0, 7);
};

const TAB = {
  DEPT: "department",
  OT: "ot",
  LATE: "late",
};

const Reports = () => {
  const dispatch = useAppDispatch();
  const departments = useAppSelector((s) => s.departments.departments) || [];

  const [tab, setTab] = useState(TAB.DEPT);
  const [date, setDate] = useState(getToday());
  const [month, setMonth] = useState(getCurrentMonth());
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deptData, setDeptData] = useState(null);
  const [otLateData, setOtLateData] = useState(null);

  useEffect(() => {
    dispatch(fetchDepartments({ status: "active" }));
  }, [dispatch]);

  const loadDeptSheet = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/daily-attendance/department-sheet", {
        params: {
          date,
          ...(department ? { department } : {}),
        },
      });
      setDeptData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setDeptData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadOtLate = async (type) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/daily-attendance/ot-late-report", {
        params: { month, type },
      });
      setOtLateData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setOtLateData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = () => {
    if (tab === TAB.DEPT) loadDeptSheet();
    else if (tab === TAB.OT) loadOtLate("ot");
    else loadOtLate("late");
  };

  const exportDeptCSV = () => {
    if (!deptData?.departments) return;
    const headers = [
      "Department",
      "Employee ID",
      "Name",
      "Shift",
      "IN",
      "OUT",
      "Status",
      "Worked (min)",
      "Late (min)",
      "OT (min)",
    ];
    const rows = [];
    for (const dept of deptData.departments) {
      for (const r of dept.records) {
        rows.push([
          dept.name,
          r.employeeId,
          r.employeeName,
          r.shiftCode || r.shift?.code || "",
          formatTime(r.firstIn),
          formatTime(r.lastOut),
          r.status,
          r.netWorkedMinutes || 0,
          r.lateMinutes || 0,
          r.overtimeMinutes || 0,
        ]);
      }
    }
    downloadCSV(`department-sheet-${date}.csv`, headers, rows);
  };

  const exportOtLateCSV = () => {
    if (!otLateData?.data) return;
    const isOt = tab === TAB.OT;
    const headers = isOt
      ? [
          "Employee ID",
          "Name",
          "OT Days",
          "Total OT (min)",
          "Total OT",
          "Present Days",
        ]
      : [
          "Employee ID",
          "Name",
          "Late Days",
          "Total Late (min)",
          "Total Late",
          "Present Days",
        ];
    const rows = otLateData.data.map((r) =>
      isOt
        ? [
            r.employeeId,
            r.employeeName,
            r.otDays,
            r.totalOvertimeMinutes,
            formatDuration(r.totalOvertimeMinutes),
            r.presentDays,
          ]
        : [
            r.employeeId,
            r.employeeName,
            r.lateDays,
            r.totalLateMinutes,
            formatDuration(r.totalLateMinutes),
            r.presentDays,
          ],
    );
    downloadCSV(
      `${isOt ? "ot" : "late"}-report-${month}.csv`,
      headers,
      rows,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FileBarChart className="text-emerald-600" size={26} />
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Department daily sheet, OT &amp; Late reports with CSV export
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab(TAB.DEPT)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            tab === TAB.DEPT
              ? "bg-emerald-600 text-white"
              : "border bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Building2 size={16} />
          Department Daily Sheet
        </button>
        <button
          onClick={() => setTab(TAB.OT)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            tab === TAB.OT
              ? "bg-emerald-600 text-white"
              : "border bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Clock size={16} />
          OT Summary
        </button>
        <button
          onClick={() => setTab(TAB.LATE)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            tab === TAB.LATE
              ? "bg-emerald-600 text-white"
              : "border bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <AlertTriangle size={16} />
          Late Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        {tab === TAB.DEPT ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Month
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={handleLoad}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Search size={16} />
          {loading ? "Loading..." : "Load Report"}
        </button>

        {((tab === TAB.DEPT && deptData?.departments?.length) ||
          ((tab === TAB.OT || tab === TAB.LATE) &&
            otLateData?.data?.length)) && (
          <button
            onClick={tab === TAB.DEPT ? exportDeptCSV : exportOtLateCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
          >
            <Download size={16} />
            Export CSV
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Department Sheet */}
      {tab === TAB.DEPT && deptData && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 text-sm">
            <span>
              Total: <strong>{deptData.summary?.total}</strong>
            </span>
            <span className="text-green-700">
              Present: <strong>{deptData.summary?.present}</strong>
            </span>
            <span className="text-orange-600">
              Late: <strong>{deptData.summary?.late}</strong>
            </span>
            <span className="text-red-600">
              Absent: <strong>{deptData.summary?.absent}</strong>
            </span>
            <span className="text-purple-600">
              Incomplete: <strong>{deptData.summary?.incomplete}</strong>
            </span>
          </div>

          {deptData.departments?.map((dept) => (
            <div
              key={dept.name}
              className="overflow-hidden rounded-xl border bg-white"
            >
              <div className="border-b bg-slate-50 px-4 py-3 font-semibold text-slate-800">
                {dept.name}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({dept.count})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Shift</th>
                      <th className="p-3">IN</th>
                      <th className="p-3">OUT</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Worked</th>
                      <th className="p-3">OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dept.records.map((r) => (
                      <tr key={r._id} className="border-t">
                        <td className="p-3 font-medium">{r.employeeId}</td>
                        <td className="p-3">{r.employeeName}</td>
                        <td className="p-3">
                          {r.shiftCode || r.shift?.code || "-"}
                        </td>
                        <td className="p-3">{formatTime(r.firstIn)}</td>
                        <td className="p-3">{formatTime(r.lastOut)}</td>
                        <td className="p-3">{r.status}</td>
                        <td className="p-3">
                          {formatDuration(r.netWorkedMinutes)}
                        </td>
                        <td className="p-3">
                          {formatDuration(r.overtimeMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!deptData.departments?.length && (
            <p className="text-center text-sm text-slate-500">
              No records for this date. Calculate daily attendance first.
            </p>
          )}
        </div>
      )}

      {/* OT / Late Report */}
      {(tab === TAB.OT || tab === TAB.LATE) && otLateData && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 text-sm">
            <span>
              Employees: <strong>{otLateData.totals?.employees}</strong>
            </span>
            {tab === TAB.OT && (
              <span>
                Total OT:{" "}
                <strong>
                  {formatDuration(otLateData.totals?.overtimeMinutes)}
                </strong>
              </span>
            )}
            {tab === TAB.LATE && (
              <span>
                Total Late:{" "}
                <strong>
                  {formatDuration(otLateData.totals?.lateMinutes)}
                </strong>
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Present Days</th>
                  {tab === TAB.OT ? (
                    <>
                      <th className="p-3">OT Days</th>
                      <th className="p-3">Total OT</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3">Late Days</th>
                      <th className="p-3">Total Late</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {otLateData.data?.map((r, i) => (
                  <tr key={r.employeeId} className="border-t">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-medium">{r.employeeId}</td>
                    <td className="p-3">{r.employeeName}</td>
                    <td className="p-3">{r.presentDays}</td>
                    {tab === TAB.OT ? (
                      <>
                        <td className="p-3">{r.otDays}</td>
                        <td className="p-3 font-medium text-emerald-700">
                          {formatDuration(r.totalOvertimeMinutes)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">{r.lateDays}</td>
                        <td className="p-3 font-medium text-orange-600">
                          {formatDuration(r.totalLateMinutes)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!otLateData.data?.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No data for this month.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
