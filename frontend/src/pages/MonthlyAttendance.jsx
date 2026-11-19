import { useEffect, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import { fetchMonthlyAttendance } from "../features/dailyAttendance/monthlyAttendanceSlice";

const getCurrentMonth = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
};

const formatHours = (minutes = 0) => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${hours}h ${remaining}m`;
};

const MonthlyAttendance = () => {
  const dispatch = useAppDispatch();

  const { records, summary, loading, error } = useAppSelector(
    (state) => state.monthlyAttendance,
  );

  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    if (month) {
      dispatch(fetchMonthlyAttendance(month));
    }
  }, [dispatch, month]);

  const handleRefresh = () => {
    dispatch(fetchMonthlyAttendance(month));
  };

  const summaryCards = [
    {
      title: "Total Employees",
      value: summary?.totalEmployees || 0,
      icon: Users,
      style: "bg-blue-50 text-blue-600",
    },
    {
      title: "Present",
      value: summary?.present || 0,
      icon: CheckCircle,
      style: "bg-green-50 text-green-600",
    },
    {
      title: "Late",
      value: summary?.late || 0,
      icon: Clock,
      style: "bg-orange-50 text-orange-600",
    },
    {
      title: "Absent",
      value: summary?.absent || 0,
      icon: XCircle,
      style: "bg-red-50 text-red-600",
    },
  ];

  const exportCSV = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Present",
      "Late",
      "Absent",
      "Incomplete",
      "Weekly Off",
      "Holiday",
      "Leave",
      "Payable Days",
      "Working Hours",
      "OT Hours",
      "Late Minutes",
      "Early Leave Minutes",
    ];

    const rows = records.map((record) => [
      record.employeeId,
      record.employeeName,
      record.present,
      record.late,
      record.absent,
      record.incomplete,
      record.weeklyOff,
      record.holiday,
      record.leave,
      record.payableDays,
      formatHours(record.workingMinutes),
      formatHours(record.overtimeMinutes),
      record.lateMinutes,
      record.earlyLeaveMinutes,
    ]);

    const escapeCSV = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    // Excel-এ বাংলা/ইংরেজি ঠিক রাখার জন্য BOM
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Monthly_Attendance_${month}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Monthly Attendance Summary
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Employee-wise monthly attendance and overtime report.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            disabled={!records.length || loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <FileSpreadsheet size={17} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Month Filter */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="max-w-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Select Month
          </label>

          <div className="relative">
            <CalendarDays
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{item.title}</p>

                  <h3 className="mt-2 text-2xl font-bold text-gray-800">
                    {item.value}
                  </h3>
                </div>

                <div className={`rounded-lg p-3 ${item.style}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total Payable Days</p>
          <h3 className="mt-2 text-xl font-bold text-gray-800">
            {summary?.payableDays || 0}
          </h3>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total Working Hours</p>
          <h3 className="mt-2 text-xl font-bold text-gray-800">
            {formatHours(summary?.workingMinutes)}
          </h3>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total OT Hours</p>
          <h3 className="mt-2 text-xl font-bold text-emerald-700">
            {formatHours(summary?.overtimeMinutes)}
          </h3>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-800">
            Employee Monthly Report
          </h2>

          <p className="mt-1 text-xs text-gray-500">Month: {month}</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading monthly attendance...
          </div>
        ) : !records.length ? (
          <div className="p-12 text-center text-gray-500">
            No monthly attendance records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-4">SL</th>
                  <th className="px-4 py-4">Employee ID</th>
                  <th className="px-4 py-4">Employee Name</th>
                  <th className="px-4 py-4">Present</th>
                  <th className="px-4 py-4">Late</th>
                  <th className="px-4 py-4">Absent</th>
                  <th className="px-4 py-4">Incomplete</th>
                  <th className="px-4 py-4">Weekly Off</th>
                  <th className="px-4 py-4">Holiday</th>
                  <th className="px-4 py-4">Leave</th>
                  <th className="px-4 py-4">Payable Days</th>
                  <th className="px-4 py-4">Working Hours</th>
                  <th className="px-4 py-4">OT Hours</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {records.map((record, index) => (
                  <tr key={record.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">{index + 1}</td>

                    <td className="px-4 py-4 font-medium">
                      {record.employeeId}
                    </td>

                    <td className="px-4 py-4 font-medium text-gray-800">
                      {record.employeeName}
                    </td>

                    <td className="px-4 py-4 text-green-700">
                      {record.present}
                    </td>

                    <td className="px-4 py-4 text-orange-600">{record.late}</td>

                    <td className="px-4 py-4 text-red-600">{record.absent}</td>

                    <td className="px-4 py-4">{record.incomplete}</td>

                    <td className="px-4 py-4">{record.weeklyOff}</td>

                    <td className="px-4 py-4">{record.holiday}</td>

                    <td className="px-4 py-4">{record.leave}</td>

                    <td className="px-4 py-4 font-semibold">
                      {record.payableDays}
                    </td>

                    <td className="px-4 py-4">
                      {formatHours(record.workingMinutes)}
                    </td>

                    <td className="px-4 py-4 font-semibold text-emerald-700">
                      {formatHours(record.overtimeMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyAttendance;
