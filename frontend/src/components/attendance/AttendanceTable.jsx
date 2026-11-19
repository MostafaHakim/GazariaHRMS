import { ChevronLeft, ChevronRight } from "lucide-react";

const AttendanceTable = ({ logs, loading, pagination, onPageChange }) => {
  const formatDateTime = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-slate-800">Raw Attendance Logs</h3>
          <p className="text-xs text-slate-500 mt-1">
            Device punch records · Bangladesh Time
          </p>
        </div>

        <span className="text-sm text-slate-500">
          Total: {pagination.total || 0}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">SL</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Device User ID</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">User SN</th>
              <th className="px-4 py-3">Punch Date & Time</th>
              <th className="px-4 py-3">Device IP</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-slate-500">
                  Loading attendance records...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-slate-500">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={log._id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 text-slate-500">
                    {(pagination.page - 1) * pagination.limit + index + 1}
                  </td>

                  <td className="px-4 py-3">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                      {log.deviceId}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-medium text-slate-800">
                    {log.deviceUserId}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {log.employeeName ? (
                      <>
                        <span className="font-medium">{log.employeeName}</span>
                        <span className="ml-1 text-xs text-slate-400">
                          ({log.employeeCode})
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-amber-600">
                        কর্মী মেলেনি
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {log.section || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {log.userSn || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {formatDateTime(log.recordTime)}
                  </td>

                  <td className="px-4 py-3 text-slate-500">{log.deviceIp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-xs text-slate-500">
          Page {pagination.page || 1} of {pagination.totalPages || 0}
        </p>

        <div className="flex gap-2">
          <button
            disabled={loading || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <button
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-40 flex items-center gap-1"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTable;
