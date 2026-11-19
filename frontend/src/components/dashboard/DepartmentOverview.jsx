const DepartmentOverview = ({ departments, employees }) => {
  const departmentStats = departments.map((department) => {
    const count = employees.filter((employee) => {
      const departmentId = employee.department?._id || employee.department;

      return departmentId === department._id;
    }).length;

    return {
      ...department,
      employeeCount: count,
    };
  });

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="font-bold text-slate-800">Department Overview</h3>
        <p className="mt-1 text-xs text-slate-400">
          Employee distribution by department
        </p>
      </div>

      {departmentStats.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No department data available
        </p>
      ) : (
        <div className="space-y-5">
          {departmentStats.map((department) => {
            const percentage =
              employees.length > 0
                ? Math.min(
                    (department.employeeCount / employees.length) * 100,
                    100,
                  )
                : 0;

            return (
              <div key={department._id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {department.name}
                    </p>
                    <p className="text-xs text-slate-400">{department.code}</p>
                  </div>

                  <span className="text-sm font-semibold text-slate-700">
                    {department.employeeCount}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DepartmentOverview;
