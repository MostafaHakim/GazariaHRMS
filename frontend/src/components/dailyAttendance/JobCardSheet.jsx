import {
  formatDate,
  formatDuration,
  formatTime,
  statusClass,
} from "../../utils/jobCardFormat";

/**
 * একজন কর্মীর একটি Job Card পেজ।
 * print এ প্রতিটি কার্ড নতুন পাতায় শুরু হয় (job-card-page ক্লাস)।
 */
const JobCardSheet = ({ company, month, section, employee, days, summary }) => {
  const stats = summary
    ? [
        ["Present", summary.present],
        ["Late", summary.late],
        ["Absent", summary.absent],
        ["Payable", summary.payableDays],
        ["Weekly Off", summary.weeklyOff],
        ["Holiday", summary.holiday],
        ["Leave", summary.leave],
        ["Worked", formatDuration(summary.totalWorkedMinutes)],
        ["OT", formatDuration(summary.totalOvertimeMinutes)],
      ]
    : [];

  return (
    <div className="job-card-page rounded-xl border bg-white p-5 print:rounded-none print:border-0 print:p-0">
      <div className="mb-2 flex items-start justify-between gap-4 border-b pb-2">
        <div>
          {company && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {company}
            </p>
          )}
          <h2 className="text-lg font-bold text-slate-800 print:text-base">
            {employee.name}
          </h2>
          <p className="text-xs text-slate-500">
            ID: {employee.employeeId}
            {employee.designation ? ` · ${employee.designation}` : ""}
            {employee.department ? ` · ${employee.department}` : ""}
            {section || employee.section
              ? ` · Section: ${section || employee.section}`
              : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">Job Card</p>
          <p className="text-xs text-slate-500">Month: {month}</p>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mb-2 grid grid-cols-5 gap-x-4 gap-y-0.5 text-xs">
          {stats.map(([label, value]) => (
            <div key={label}>
              <span className="text-slate-500">{label}: </span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left text-[11px] print:text-[10px]">
          <thead className="bg-slate-50 uppercase text-slate-600">
            <tr>
              {[
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
              ].map((h) => (
                <th key={h} className="px-2 py-1.5 print:py-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d._id} className="break-inside-avoid border-t">
                <td className="px-2 py-1 font-medium print:py-0.5">
                  {formatDate(d.attendanceDate)}
                  {d.isManuallyEdited && (
                    <span className="ml-1 text-[9px] text-amber-600">M</span>
                  )}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {d.shiftCode || d.shift?.code || "-"}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatTime(d.firstIn)}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatTime(d.lastOut)}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatDuration(d.netWorkedMinutes)}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatDuration(d.lateMinutes)}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatDuration(d.earlyLeaveMinutes)}
                </td>
                <td className="px-2 py-1 print:py-0.5">
                  {formatDuration(d.overtimeMinutes)}
                </td>
                <td
                  className={`px-2 py-1 font-medium print:py-0.5 ${
                    statusClass[d.status] || ""
                  }`}
                >
                  {d.status}
                </td>
                <td className="px-2 py-1 text-[10px] text-slate-500 print:py-0.5">
                  {d.remarks || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JobCardSheet;
