import { useState } from "react";
import { FileText, Search, Printer, Download } from "lucide-react";
import api from "../services/api";

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

const formatTime = (date) => {
  if (!date) return "--";
  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatDate = (date) => {
  if (!date) return "-";
  return String(date).slice(0, 10);
};

const formatDuration = (minutes = 0) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const statusClass = {
  PRESENT: "text-green-700",
  LATE: "text-orange-600",
  ABSENT: "text-red-600",
  INCOMPLETE: "text-purple-600",
  WEEKLY_OFF: "text-gray-500",
  HOLIDAY: "text-blue-600",
  LEAVE: "text-yellow-700",
};

const JobCard = () => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;

  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const load = async (e) => {
    e?.preventDefault();
    if (!employeeId.trim()) {
      setError("Employee ID দিন");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await api.get("/daily-attendance/job-card", {
        params: {
          employeeId: employeeId.trim().toUpperCase(),
          month,
        },
      });
      setData(res.data);
      if (!res.data.days?.length) {
        setError("এই মাসে কোনো অ্যাটেনডেন্স রেকর্ড নেই। আগে Calculate করুন।");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data?.days?.length) return;
    const headers = [
      "Date",
      "Shift",
      "IN",
      "OUT",
      "Worked",
      "Late",
      "Early",
      "OT",
      "Status",
      "Remarks",
    ];
    const rows = data.days.map((d) => [
      formatDate(d.attendanceDate),
      d.shiftCode || d.shift?.code || "",
      formatTime(d.firstIn),
      formatTime(d.lastOut),
      formatDuration(d.netWorkedMinutes),
      formatDuration(d.lateMinutes),
      formatDuration(d.earlyLeaveMinutes),
      formatDuration(d.overtimeMinutes),
      d.status,
      d.remarks || "",
    ]);
    downloadCSV(
      `job-card-${data.employee?.employeeId || "emp"}-${data.month}.csv`,
      headers,
      rows,
    );
  };

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <FileText className="text-emerald-600" size={26} />
            Employee Job Card
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            একজন কর্মীর পুরো মাসের IN/OUT ও স্ট্যাটাস রিপোর্ট
          </p>
        </div>
      </div>

      <form
        onSubmit={load}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 print:hidden"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Employee ID
          </label>
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. EMP001"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
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
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Search size={16} />
          {loading ? "Loading..." : "Load Job Card"}
        </button>
        {data?.days?.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              <Printer size={16} />
              Print
            </button>
          </>
        )}
      </form>

      {error && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 print:hidden">
          {error}
        </div>
      )}

      {data?.employee && (
        <div className="space-y-4 print:space-y-2" id="job-card-print">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {data.employee.name}
                </h2>
                <p className="text-sm text-slate-500">
                  ID: {data.employee.employeeId} · Month: {data.month}
                </p>
              </div>
              {summary && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-slate-500">Present: </span>
                    <strong>{summary.present}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Late: </span>
                    <strong>{summary.late}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Absent: </span>
                    <strong>{summary.absent}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Payable: </span>
                    <strong>{summary.payableDays}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Weekly Off: </span>
                    <strong>{summary.weeklyOff}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Holiday: </span>
                    <strong>{summary.holiday}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Worked: </span>
                    <strong>
                      {formatDuration(summary.totalWorkedMinutes)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">OT: </span>
                    <strong>
                      {formatDuration(summary.totalOvertimeMinutes)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">IN</th>
                  <th className="p-3">OUT</th>
                  <th className="p-3">Worked</th>
                  <th className="p-3">Late</th>
                  <th className="p-3">Early</th>
                  <th className="p-3">OT</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d._id} className="border-t">
                    <td className="p-3 font-medium">
                      {formatDate(d.attendanceDate)}
                      {d.isManuallyEdited && (
                        <span className="ml-1 text-[10px] text-amber-600">
                          M
                        </span>
                      )}
                    </td>
                    <td className="p-3">{d.shiftCode || d.shift?.code || "-"}</td>
                    <td className="p-3">{formatTime(d.firstIn)}</td>
                    <td className="p-3">{formatTime(d.lastOut)}</td>
                    <td className="p-3">
                      {formatDuration(d.netWorkedMinutes)}
                    </td>
                    <td className="p-3">{formatDuration(d.lateMinutes)}</td>
                    <td className="p-3">
                      {formatDuration(d.earlyLeaveMinutes)}
                    </td>
                    <td className="p-3">
                      {formatDuration(d.overtimeMinutes)}
                    </td>
                    <td
                      className={`p-3 font-medium ${
                        statusClass[d.status] || ""
                      }`}
                    >
                      {d.status}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {d.remarks || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;
