import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchWeeklyRoster,
  generateWeeklyRoster,
  updateRosterShift,
  changeShiftMidWeek,
  clearMidWeekChange,
  publishRoster,
  clearRosterMessage,
} from "../features/roster/rosterSlice";

import api from "../services/api";

import {
  CalendarDays,
  RefreshCw,
  Users,
  Sun,
  Moon,
  Clock,
  Search,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CalendarCheck,
  Shuffle,
  X,
  Undo2,
} from "lucide-react";

// Local date formatter
const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Saturday is the first day of the week
const getSaturday = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const difference = (day + 1) % 7;

  date.setDate(date.getDate() - difference);

  return formatDateInput(date);
};

const formatDate = (dateString) => {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

// Saturday-ভিত্তিক সপ্তাহের ৭টি দিন
const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

// কোন দিনে কোন শিফট (Override থাকলে সেটি, না থাকলে সপ্তাহের মূল শিফট)
const getDayShift = (entry, dateString) => {
  const override = (entry.dayOverrides || []).find(
    (item) => String(item.date).slice(0, 10) === dateString,
  );

  return {
    shift: override?.shift || entry.shift,
    overridden: Boolean(override),
  };
};

const shiftStyles = {
  "DAY-01": {
    label: "Day Shift",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Sun,
  },

  "NIGHT-01": {
    label: "Night Shift",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: Moon,
  },

  "WOMEN-01": {
    label: "Women Day",
    color: "bg-pink-50 text-pink-700 border-pink-200",
    icon: Sun,
  },
};

const WeeklyRoster = () => {
  const dispatch = useDispatch();
  const activeCompanyId = useSelector((state) => state.company.activeCompanyId);

  const {
    currentRoster,
    loading,
    generating,
    saving,
    publishing,
    error,
    successMessage,
  } = useSelector((state) => state.roster);

  const [weekDate, setWeekDate] = useState(() =>
    getSaturday(formatDateInput(new Date())),
  );

  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [shifts, setShifts] = useState([]);
  const [shiftSelections, setShiftSelections] = useState({});
  const [remarks, setRemarks] = useState({});
  const [localError, setLocalError] = useState("");
  const [midWeek, setMidWeek] = useState(null); // { entry, fromDate, toDate, shiftCode, remarks }

  // Fetch shifts
  useEffect(() => {
    const loadShifts = async () => {
      try {
        const response = await api.get("/shifts");

        setShifts(response.data.shifts || []);
      } catch (error) {
        setLocalError(
          error.response?.data?.message || "Shift List Load Failed",
        );
      }
    };

    loadShifts();
  }, [activeCompanyId]);

  // Fetch roster
  const loadRoster = useCallback(() => {
    dispatch(fetchWeeklyRoster(weekDate));
  }, [dispatch, weekDate, activeCompanyId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Clear messages after date change
  useEffect(() => {
    dispatch(clearRosterMessage());
  }, [weekDate, dispatch]);

  // Get entries
  const entries = currentRoster?.entries || [];

  // Filter employees
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        entry.employeeName?.toLowerCase().includes(keyword) ||
        entry.employeeId?.toLowerCase().includes(keyword);

      const selectedCode =
        shiftSelections[entry.employee] || entry.shift?.code || "";

      const matchesShift =
        shiftFilter === "ALL" || selectedCode === shiftFilter;

      return matchesSearch && matchesShift;
    });
  }, [entries, search, shiftFilter, shiftSelections]);

  // Shift counts
  const dayCount = entries.filter(
    (entry) =>
      (shiftSelections[entry.employee] || entry.shift?.code) === "DAY-01",
  ).length;

  const nightCount = entries.filter(
    (entry) =>
      (shiftSelections[entry.employee] || entry.shift?.code) === "NIGHT-01",
  ).length;

  const womenCount = entries.filter(
    (entry) =>
      (shiftSelections[entry.employee] || entry.shift?.code) === "WOMEN-01",
  ).length;

  // Generate roster
  const handleGenerate = async () => {
    const confirmed = window.confirm(
      "এই সপ্তাহের Weekly Roster Generate করতে চান?",
    );

    if (!confirmed) return;

    setLocalError("");

    const result = await dispatch(generateWeeklyRoster(weekDate));

    if (generateWeeklyRoster.fulfilled.match(result)) {
      setShiftSelections({});
      setRemarks({});
    }
  };

  // Change shift locally
  const handleShiftChange = (employeeObjectId, shiftCode) => {
    setShiftSelections((prev) => ({
      ...prev,
      [employeeObjectId]: shiftCode,
    }));
  };

  // Save manual shift
  const handleSaveShift = async (entry) => {
    const employeeObjectId =
      typeof entry.employee === "object" ? entry.employee._id : entry.employee;

    const shiftCode = shiftSelections[employeeObjectId];

    if (!shiftCode || shiftCode === entry.shift?.code) {
      return;
    }

    const result = await dispatch(
      updateRosterShift({
        rosterId: currentRoster._id,
        employeeId: employeeObjectId,
        shiftCode,
        remarks: remarks[employeeObjectId] || "",
      }),
    );

    if (updateRosterShift.fulfilled.match(result)) {
      setShiftSelections((prev) => {
        const updated = { ...prev };
        delete updated[employeeObjectId];
        return updated;
      });

      setRemarks((prev) => {
        const updated = { ...prev };
        delete updated[employeeObjectId];
        return updated;
      });
    }
  };

  // Mid-week shift change modal
  const openMidWeek = (entry) => {
    const today = formatDateInput(new Date());
    const weekEndDate = addDays(weekDate, 6);
    const defaultFrom =
      today >= weekDate && today <= weekEndDate ? today : addDays(weekDate, 1);

    const baseCode = entry.shift?.code || "";
    const otherShift = shifts.find((shift) => shift.code !== baseCode);

    setMidWeek({
      entry,
      fromDate: defaultFrom,
      toDate: weekEndDate,
      shiftCode: otherShift?.code || "",
      remarks: "",
    });
  };

  const handleMidWeekSave = async () => {
    if (!midWeek || !currentRoster?._id) return;

    const employeeObjectId =
      typeof midWeek.entry.employee === "object"
        ? midWeek.entry.employee._id
        : midWeek.entry.employee;

    const result = await dispatch(
      changeShiftMidWeek({
        rosterId: currentRoster._id,
        employeeId: employeeObjectId,
        fromDate: midWeek.fromDate,
        toDate: midWeek.toDate,
        shiftCode: midWeek.shiftCode,
        remarks: midWeek.remarks,
      }),
    );

    if (changeShiftMidWeek.fulfilled.match(result)) {
      setMidWeek(null);
    }
  };

  const handleMidWeekClear = async (entry) => {
    const confirmed = window.confirm(
      `${entry.employeeName} এর মাঝ-সপ্তাহের শিফট বদল তুলে মূল শিফটে ফিরতে চান?`,
    );

    if (!confirmed) return;

    const employeeObjectId =
      typeof entry.employee === "object" ? entry.employee._id : entry.employee;

    await dispatch(
      clearMidWeekChange({
        rosterId: currentRoster._id,
        employeeId: employeeObjectId,
      }),
    );
  };

  // Publish roster
  const handlePublish = async () => {
    if (!currentRoster?._id) return;

    const confirmed = window.confirm(
      "Roster Publish করলে এটি চূড়ান্ত হিসেবে গণ্য হবে। Publish করতে চান?",
    );

    if (!confirmed) return;

    await dispatch(publishRoster(currentRoster._id));
  };

  const weekEnd = useMemo(() => {
    const date = new Date(`${weekDate}T12:00:00`);
    date.setDate(date.getDate() + 6);

    return formatDateInput(date);
  }, [weekDate]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-emerald-600" />

            <h1 className="text-2xl font-bold text-gray-800">Weekly Roster</h1>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Manage weekly employee shifts and rotation schedules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadRoster}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CalendarCheck size={16} />
            )}

            {generating ? "Generating..." : "Generate Roster"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {(error || localError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error || localError}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}

      {/* Week Selection */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Select Week
            </label>

            <input
              type="date"
              value={weekDate}
              onChange={(e) => {
                setWeekDate(getSaturday(e.target.value));
                setShiftSelections({});
                setSearch("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Week Start</p>
            <p className="mt-1 font-semibold text-gray-800">
              {formatDate(weekDate)}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Week End</p>
            <p className="mt-1 font-semibold text-gray-800">
              {formatDate(weekEnd)}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={entries.length}
          icon={Users}
          color="bg-blue-50 text-blue-600"
        />

        <StatCard
          title="Day Shift"
          value={dayCount}
          icon={Sun}
          color="bg-amber-50 text-amber-600"
        />

        <StatCard
          title="Night Shift"
          value={nightCount}
          icon={Moon}
          color="bg-indigo-50 text-indigo-600"
        />

        <StatCard
          title="Women Day Shift"
          value={womenCount}
          icon={Clock}
          color="bg-pink-50 text-pink-600"
        />
      </div>

      {/* Roster Status */}
      {currentRoster && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  currentRoster.status === "PUBLISHED"
                    ? "bg-green-500"
                    : "bg-amber-500"
                }`}
              />

              <span className="font-semibold text-gray-800">
                {currentRoster.status === "PUBLISHED"
                  ? "Published Roster"
                  : "Draft Roster"}
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {formatDate(currentRoster.weekStartDate)} -{" "}
              {formatDate(currentRoster.weekEndDate)}
            </p>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing || currentRoster.status === "PUBLISHED"}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {publishing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}

            {currentRoster.status === "PUBLISHED"
              ? "Already Published"
              : publishing
                ? "Publishing..."
                : "Publish Roster"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search Employee ID or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Shifts</option>
            {shifts.map((shift) => (
              <option key={shift._id} value={shift.code}>
                {shift.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="font-bold text-gray-800">Employee Shift Schedule</h2>

            <p className="mt-1 text-xs text-gray-500">
              {filteredEntries.length} employees found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="animate-spin" size={22} />
            Loading Roster...
          </div>
        ) : !currentRoster ? (
          <div className="py-16 text-center">
            <CalendarDays size={40} className="mx-auto mb-3 text-gray-300" />

            <h3 className="font-semibold text-gray-700">No Roster Found</h3>

            <p className="mt-1 text-sm text-gray-500">
              Generate a roster for the selected week.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No matching employees found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">SL</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Employee Name</th>
                  <th className="px-4 py-3">Assigned Shift</th>
                  <th className="px-4 py-3">Shift Type</th>
                  <th className="px-4 py-3">Day-wise Shift</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((entry, index) => {
                  const employeeObjectId =
                    typeof entry.employee === "object"
                      ? entry.employee._id
                      : entry.employee;

                  const currentShiftCode = entry.shift?.code || "";

                  const selectedShift =
                    shiftSelections[employeeObjectId] || currentShiftCode;

                  const isChanged = selectedShift !== currentShiftCode;

                  const style = shiftStyles[currentShiftCode] || {
                    label: entry.shift?.name || currentShiftCode || "Shift",
                    color: "bg-slate-50 text-slate-700 border-slate-200",
                    icon: Sun,
                  };

                  const ShiftIcon = style.icon;

                  return (
                    <tr
                      key={employeeObjectId}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>

                      <td className="px-4 py-3 font-medium text-gray-700">
                        {entry.employeeId}
                      </td>

                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {entry.employeeName}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={selectedShift}
                          disabled={currentRoster.status === "PUBLISHED"}
                          onChange={(e) =>
                            handleShiftChange(employeeObjectId, e.target.value)
                          }
                          className="min-w-[170px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-500 disabled:bg-gray-100"
                        >
                          {shifts
                            .map((shift) => (
                              <option key={shift._id} value={shift.code}>
                                {shift.name}
                              </option>
                            ))}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${style.color}`}
                        >
                          <ShiftIcon size={13} />
                          {style.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {DAY_LABELS.map((label, dayIndex) => {
                            const dateString = addDays(weekDate, dayIndex);
                            const { shift: dayShift, overridden } = getDayShift(
                              entry,
                              dateString,
                            );
                            const isNight = Boolean(
                              dayShift?.isNightShift ||
                                String(dayShift?.code || "").startsWith("NIGHT"),
                            );
                            const isFridayOff = label === "Fri";

                            return (
                              <div
                                key={label}
                                title={`${label} ${dateString}: ${
                                  isFridayOff ? "Weekly Off" : dayShift?.name || "-"
                                }${overridden ? " (মাঝ-সপ্তাহে বদল)" : ""}`}
                                className={`flex w-9 flex-col items-center rounded-md border px-1 py-1 text-[10px] leading-tight ${
                                  isFridayOff
                                    ? "border-gray-200 bg-gray-50 text-gray-400"
                                    : isNight
                                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                } ${overridden ? "ring-2 ring-purple-400" : ""}`}
                              >
                                <span className="font-medium">{label}</span>
                                <span className="font-bold">
                                  {isFridayOff ? "OFF" : isNight ? "N" : "D"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {entry.source === "MANUAL" ? (
                          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                            Manual
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            Automatic
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isChanged && (
                            <button
                              onClick={() => handleSaveShift(entry)}
                              disabled={saving}
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Save size={14} />
                              Save
                            </button>
                          )}

                          <button
                            onClick={() => openMidWeek(entry)}
                            disabled={saving}
                            title="সপ্তাহের মাঝখান থেকে শিফট বদল (Published Roster-এও করা যায়)"
                            className="flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                          >
                            <Shuffle size={14} />
                            Mid-week
                          </button>

                          {(entry.dayOverrides || []).length > 0 && (
                            <button
                              onClick={() => handleMidWeekClear(entry)}
                              disabled={saving}
                              title="মাঝ-সপ্তাহের বদল তুলে নিন"
                              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mid-week Shift Change Modal */}
      {midWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">
                  সপ্তাহের মাঝখানে শিফট বদল
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {midWeek.entry.employeeName} ({midWeek.entry.employeeId}) ·
                  এই সপ্তাহের মূল শিফট: {midWeek.entry.shift?.name || "-"}
                </p>
              </div>

              <button
                onClick={() => setMidWeek(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    কোন তারিখ থেকে
                  </label>
                  <input
                    type="date"
                    value={midWeek.fromDate}
                    min={weekDate}
                    max={weekEnd}
                    onChange={(e) =>
                      setMidWeek((prev) => ({ ...prev, fromDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    কোন তারিখ পর্যন্ত
                  </label>
                  <input
                    type="date"
                    value={midWeek.toDate}
                    min={midWeek.fromDate || weekDate}
                    max={weekEnd}
                    onChange={(e) =>
                      setMidWeek((prev) => ({ ...prev, toDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  নতুন শিফট
                </label>
                <select
                  value={midWeek.shiftCode}
                  onChange={(e) =>
                    setMidWeek((prev) => ({ ...prev, shiftCode: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  {shifts.map((shift) => (
                    <option key={shift._id} value={shift.code}>
                      {shift.name} ({shift.startTime} - {shift.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  কারণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={midWeek.remarks}
                  onChange={(e) =>
                    setMidWeek((prev) => ({ ...prev, remarks: e.target.value }))
                  }
                  placeholder="যেমন: রাতের শিফটে লোক কম"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <p className="rounded-lg bg-purple-50 p-2.5 text-xs leading-5 text-purple-800">
                শুধু নির্বাচিত দিনগুলোর শিফট বদলাবে। আগের দিনগুলো আগের শিফটেই
                থাকবে এবং পরের সপ্তাহের Rotation অপরিবর্তিত থাকবে। আজ পর্যন্ত
                দিনগুলোর Attendance নিজে থেকে আবার হিসাব হবে।
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setMidWeek(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                বাতিল
              </button>

              <button
                onClick={handleMidWeekSave}
                disabled={
                  saving ||
                  !midWeek.shiftCode ||
                  !midWeek.fromDate ||
                  !midWeek.toDate
                }
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Shuffle size={15} />
                )}
                শিফট বদল করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Rules */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-gray-800">Shift Rules</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ShiftRule
            title="General Day"
            time="08:00 AM - 08:00 PM"
            icon={Sun}
            color="text-amber-600"
          />

          <ShiftRule
            title="General Night"
            time="08:00 PM - 06:00 AM"
            icon={Moon}
            color="text-indigo-600"
          />

          <ShiftRule
            title="Women Day"
            time="07:00 AM - 07:00 PM"
            icon={Sun}
            color="text-pink-600"
          />
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Weekly rotation starts every Saturday. শিফট শুরুর ১০ মিনিটের বেশি দেরি হলে Late ধরা হয়।
        </p>
      </div>
    </div>
  );
};

// Statistics Card
const StatCard = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-gray-800">{value}</h3>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
};

// Shift Rule Card
const ShiftRule = ({ title, time, icon: Icon, color }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
      <Icon size={22} className={color} />

      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>

        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
};

export default WeeklyRoster;
