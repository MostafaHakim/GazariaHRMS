import { Link } from "react-router-dom";

const RecentEmployees = ({ employees }) => {
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.joiningDate || 0) - new Date(a.joiningDate || 0))
    .slice(0, 6);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800">Recent Employees</h3>
          <p className="mt-1 text-xs text-slate-400">
            Latest employee records by joining date
          </p>
        </div>

        <Link
          to="/employees"
          className="text-xs font-semibold text-emerald-700 hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Department</th>
              <th className="p-3">Designation</th>
              <th className="p-3">Joining Date</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {recentEmployees.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-400">
                  No employee records available
                </td>
              </tr>
            ) : (
              recentEmployees.map((employee) => (
                <tr key={employee._id} className="border-t">
                  <td className="p-3">
                    <p className="font-medium text-slate-700">
                      {employee.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {employee.employeeId}
                    </p>
                  </td>

                  <td className="p-3">{employee.department?.name || "-"}</td>

                  <td className="p-3">{employee.designation?.name || "-"}</td>

                  <td className="p-3">
                    {employee.joiningDate
                      ? new Date(employee.joiningDate).toLocaleDateString(
                          "en-GB",
                          { timeZone: "Asia/Dhaka" },
                        )
                      : "-"}
                  </td>

                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        employee.employmentStatus === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {employee.employmentStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentEmployees;
