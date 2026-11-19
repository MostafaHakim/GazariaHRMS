import { useEffect, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import {
  fetchDailyAttendance,
  calculateDailyAttendance,
  clearDailyAttendanceMessages,
} from "../features/dailyAttendance/dailyAttendanceSlice";

import AttendanceSummary from "../components/dailyAttendance/AttendanceSummary";
import DailyAttendanceTable from "../components/dailyAttendance/DailyAttendanceTable";

const getToday = () => {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
};

const DailyAttendance = () => {
  const dispatch = useAppDispatch();

  const {
    records,
    summary,
    sections,
    pagination,
    loading,
    calculating,
    error,
    successMessage,
    calculationSummary,
  } = useAppSelector((state) => state.dailyAttendance);

  const [date, setDate] = useState(getToday());
  // Date Range mode
  const [rangeMode, setRangeMode] = useState(false);
  const [fromDate, setFromDate] = useState(getToday());
  const [toDate, setToDate] = useState(getToday());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [page, setPage] = useState(1);

  const buildParams = (pageNo) => ({
    ...(rangeMode ? { from: fromDate, to: toDate } : { date }),
    page: pageNo,
    limit: 50,
    ...(employeeSearch.trim() ? { employeeId: employeeSearch.trim() } : {}),
    ...(status ? { status } : {}),
    ...(section ? { section } : {}),
  });

  const loadAttendance = () => {
    dispatch(fetchDailyAttendance(buildParams(page)));
  };

  useEffect(() => {
    loadAttendance();
  }, [date, rangeMode, fromDate, toDate, page, status, section]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);

    dispatch(fetchDailyAttendance(buildParams(1)));
  };

  const handleCalculate = async () => {
    dispatch(clearDailyAttendanceMessages());

    const result = await dispatch(
      calculateDailyAttendance(rangeMode ? { fromDate, toDate } : date),
    );

    if (calculateDailyAttendance.fulfilled.match(result)) {
      setPage(1);

      dispatch(fetchDailyAttendance(buildParams(1)));
    }
  };

  const handleDateChange = (value) => {
    setDate(value);
    setPage(1);
    dispatch(clearDailyAttendanceMessages());
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Daily Attendance Report
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Daily employee attendance, working hours and overtime report.
          </p>
        </div>

        <button
          onClick={loadAttendance}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Date and Calculation */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex gap-2">
          {[
            [false, "একদিন"],
            [true, "Date Range (একাধিক দিন)"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setRangeMode(value);
                setPage(1);
                dispatch(clearDailyAttendanceMessages());
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                rangeMode === value
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {rangeMode ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    if (toDate < e.target.value) setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Attendance Date
              </label>

              <div className="relative">
                <CalendarDays
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={(rangeMode ? !fromDate || !toDate : !date) || calculating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Calculator
                size={18}
                className={calculating ? "animate-pulse" : ""}
              />

              {calculating
                ? "Calculating..."
                : rangeMode
                  ? "Calculate Date Range"
                  : "Calculate Attendance"}
            </button>
          </div>

          <div className="flex items-end">
            <div className="w-full rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <p className="font-semibold">Automatic Calculation</p>
              <p className="mt-1 text-xs">
                First Punch = IN | Last Punch = OUT
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle size={18} />
              {successMessage}
            </div>

            {calculationSummary?.range && (
              <div className="mt-2 space-y-2">
                <p>
                  Days: {calculationSummary.successDays}/{calculationSummary.days}
                  {" | "}Processed: {calculationSummary.processed}
                  {" | "}Present: {calculationSummary.present}
                  {" | "}Late: {calculationSummary.late}
                  {" | "}Absent: {calculationSummary.absent}
                  {" | "}Incomplete: {calculationSummary.incomplete}
                  {" | "}Leave: {calculationSummary.leave}
                </p>

                {calculationSummary.failedDays > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">
                      যে দিনগুলো হিসাব হয়নি ({calculationSummary.failedDays}):
                    </p>
                    {calculationSummary.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <p key={r.date} className="mt-1">
                          {r.date}: {r.error}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            )}

            {calculationSummary && !calculationSummary.range && (
              <p className="mt-2">
                Processed: {calculationSummary.processed} | Present:{" "}
                {calculationSummary.present} | Late: {calculationSummary.late} |
                Absent: {calculationSummary.absent} | Incomplete:{" "}
                {calculationSummary.incomplete}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <AttendanceSummary summary={summary} />

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        {/* Quick tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            ["", "All"],
            ["PRESENT", "Present"],
            ["LATE", "Late"],
            ["ABSENT", "Absent"],
            ["NIGHT", "Night"],
            ["INCOMPLETE", "Incomplete"],
          ].map(([value, label]) => (
            <button
              key={value || "ALL"}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                status === value
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__NONE__">No Section</option>
          </select>

          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search Employee ID"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-600"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-emerald-600"
          >
            <option value="">All Status</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="NIGHT">Night</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="WEEKLY_OFF">Weekly Off</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="LEAVE">Leave</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white hover:bg-gray-900"
          >
            Search
          </button>
        </form>
      </div>

      {/* Attendance Table */}
      <DailyAttendanceTable
        records={records}
        loading={loading}
        showDate={rangeMode}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
          <p className="text-sm text-gray-500">
            Total Records: {pagination.total}
            {" | "}
            Page {pagination.page} of {pagination.totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => prev - 1)}
              className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="px-2 text-sm font-medium">{page}</span>

            <button
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyAttendance;
