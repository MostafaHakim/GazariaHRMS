import { useState } from "react";
import { Clock, AlertCircle, Pencil, X } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { manualUpdateAttendance } from "../../features/dailyAttendance/dailyAttendanceSlice";

const formatTime = (date) => {
  if (!date) return "--";

  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatDuration = (minutes = 0) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const statusStyles = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-orange-100 text-orange-700",
  ABSENT: "bg-red-100 text-red-700",
  INCOMPLETE: "bg-purple-100 text-purple-700",
  WEEKLY_OFF: "bg-gray-100 text-gray-700",
  HOLIDAY: "bg-blue-100 text-blue-700",
  LEAVE: "bg-yellow-100 text-yellow-700",
  NIGHT: "bg-indigo-100 text-indigo-700",
};

const toHHmm = (date) => {
  if (!date) return "";
  return formatTime(date);
};

const DailyAttendanceTable = ({
  records = [],
  loading,
  onUpdated,
  showDate = false,
}) => {
  const dispatch = useAppDispatch();
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEdit = (record) => {
    setEditRecord(record);
    setError("");
    setForm({
      firstIn: toHHmm(record.firstIn),
      lastOut: toHHmm(record.lastOut),
      status: record.status || "PRESENT",
      lateMinutes: record.lateMinutes ?? 0,
      earlyLeaveMinutes: record.earlyLeaveMinutes ?? 0,
      overtimeMinutes: record.overtimeMinutes ?? 0,
      remarks: record.remarks || "",
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editRecord) return;
    setSaving(true);
    setError("");
    try {
      await dispatch(
        manualUpdateAttendance({
          id: editRecord._id,
          data: {
            firstIn: form.firstIn || null,
            lastOut: form.lastOut || null,
            status: form.status,
            lateMinutes: Number(form.lateMinutes) || 0,
            earlyLeaveMinutes: Number(form.earlyLeaveMinutes) || 0,
            overtimeMinutes: Number(form.overtimeMinutes) || 0,
            remarks: form.remarks,
          },
        }),
      ).unwrap();
      setEditRecord(null);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(typeof err === "string" ? err : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
        Loading attendance records...
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center">
        <AlertCircle className="mx-auto mb-3 text-gray-400" size={36} />
        <h3 className="font-semibold text-gray-700">
          No Attendance Records Found
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Select a date and calculate attendance.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-4">SL</th>
                {showDate && <th className="px-4 py-4">Date</th>}
                <th className="px-4 py-4">Employee ID</th>
                <th className="px-4 py-4">Employee Name</th>
                <th className="px-4 py-4">Shift</th>
                <th className="px-4 py-4">IN Time</th>
                <th className="px-4 py-4">OUT Time</th>
                <th className="px-4 py-4">Punches</th>
                <th className="px-4 py-4">Working Hours</th>
                <th className="px-4 py-4">Late</th>
                <th className="px-4 py-4">Early Leave</th>
                <th className="px-4 py-4">OT Hours</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {records.map((record, index) => (
                <tr key={record._id} className="transition hover:bg-gray-50">
                  <td className="px-4 py-4">{index + 1}</td>
                  {showDate && (
                    <td className="whitespace-nowrap px-4 py-4">
                      {new Date(record.attendanceDate).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </td>
                  )}
                  <td className="px-4 py-4 font-medium text-gray-700">
                    {record.employeeId}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span>{record.employeeName}</span>
                      {record.isManuallyEdited && (
                        <span className="text-[11px] text-amber-600">
                          Manual edit
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {record.shiftCode || record.shift?.code || "-"}
                  </td>
                  <td className="px-4 py-4">{formatTime(record.firstIn)}</td>
                  <td className="px-4 py-4">{formatTime(record.lastOut)}</td>
                  <td className="px-4 py-4">{record.punchCount ?? 0}</td>
                  <td className="px-4 py-4">
                    {formatDuration(record.netWorkedMinutes)}
                  </td>
                  <td className="px-4 py-4">
                    {formatDuration(record.lateMinutes)}
                  </td>
                  <td className="px-4 py-4">
                    {formatDuration(record.earlyLeaveMinutes)}
                  </td>
                  <td className="px-4 py-4">
                    {formatDuration(record.overtimeMinutes)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        statusStyles[record.displayStatus || record.status] || "bg-gray-100"
                      }`}
                    >
                      {record.displayStatus || record.status}
                    </span>
                    {record.status === "INCOMPLETE" && record.lateMinutes > 0 && (
                      <span
                        className="ml-1.5 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
                        title="একটি পাঞ্চ আছে, কিন্তু শিফট শুরুর ১০ মিনিটের বেশি দেরিতে এসেছে"
                      >
                        LATE {record.lateMinutes}m
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => openEdit(record)}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="Manual edit / fix missing punch"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Edit Modal */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Manual Punch Edit
                </h2>
                <p className="text-xs text-slate-500">
                  {editRecord.employeeName} ({editRecord.employeeId})
                </p>
              </div>
              <button
                onClick={() => setEditRecord(null)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5">
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Missing IN/OUT ঠিক করতে সময় দিন (HH:mm, BD time)। সেভ করলে
                auto-calculate আর এই রেকর্ড overwrite করবে না।
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    IN Time
                  </label>
                  <input
                    type="time"
                    value={form.firstIn}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstIn: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    OUT Time
                  </label>
                  <input
                    type="time"
                    value={form.lastOut}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastOut: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {[
                    "PRESENT",
                    "LATE",
                    "ABSENT",
                    "INCOMPLETE",
                    "WEEKLY_OFF",
                    "HOLIDAY",
                    "LEAVE",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Late (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.lateMinutes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lateMinutes: e.target.value }))
                    }
                    className="w-full rounded-lg border px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Early (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.earlyLeaveMinutes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        earlyLeaveMinutes: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    OT (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.overtimeMinutes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        overtimeMinutes: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border px-2 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Remarks</label>
                <input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  placeholder="e.g. Device miss — manual IN"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Manual Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyAttendanceTable;
