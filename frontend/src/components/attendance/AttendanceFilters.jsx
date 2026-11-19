import { Search, Filter, RotateCcw } from "lucide-react";

const AttendanceFilters = ({
  filters,
  setFilters,
  onSearch,
  onReset,
  options = { devices: [], sections: [], departments: [] },
}) => {
  const selectClass =
    "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500";

  // Enter চাপলে সার্চ
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} className="text-slate-500" />
        <h3 className="font-semibold text-slate-700">Filter Attendance</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Name / Employee ID / Device User ID"
          value={filters.search}
          onKeyDown={handleKeyDown}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <select
          value={filters.section}
          onChange={(e) => setFilters({ ...filters, section: e.target.value })}
          className={selectClass}
        >
          <option value="">All Sections</option>
          {options.sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
          <option value="__NONE__">Section নেই</option>
        </select>

        <select
          value={filters.department}
          onChange={(e) =>
            setFilters({ ...filters, department: e.target.value })
          }
          className={selectClass}
        >
          <option value="">All Departments</option>
          {options.departments.map((dept) => (
            <option key={dept._id} value={dept._id}>
              {dept.name}
            </option>
          ))}
        </select>

        <select
          value={filters.deviceId}
          onChange={(e) => setFilters({ ...filters, deviceId: e.target.value })}
          className={selectClass}
        >
          <option value="">All Devices</option>
          {options.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.deviceId}
              {device.name ? ` — ${device.name}` : ""}
            </option>
          ))}
        </select>

        <input
          type="date"
          title="From date"
          value={filters.startDate}
          onChange={(e) =>
            setFilters({ ...filters, startDate: e.target.value })
          }
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />

        <input
          type="date"
          title="To date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />

        <div className="flex gap-2">
          <button
            onClick={onSearch}
            className="flex-1 bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-emerald-700 flex items-center justify-center gap-2"
          >
            <Search size={16} />
            Search
          </button>

          <button
            onClick={onReset}
            title="Reset Filters"
            className="border border-slate-200 rounded-lg px-3 hover:bg-slate-50"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceFilters;
