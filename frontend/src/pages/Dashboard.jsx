import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  Building2,
  CalendarOff,
  ChevronRight,
  Clock,
  UserPlus,
  Users,
  Wallet,
  CalendarDays,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import api from "../services/api";
import { fetchEmployees } from "../features/employees/employeeSlice";
import { fetchDepartments } from "../features/departments/departmentSlice";

import AttendanceTape from "../components/dashboard/AttendanceTape";
import DepartmentOverview from "../components/dashboard/DepartmentOverview";
import RecentEmployees from "../components/dashboard/RecentEmployees";

const panel = "rounded-xl border border-slate-200 bg-white shadow-sm";

const getGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Dhaka",
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return "শুভ সকাল";
  if (hour >= 12 && hour < 16) return "শুভ দুপুর";
  if (hour >= 16 && hour < 18) return "শুভ বিকেল";
  if (hour >= 18 && hour < 20) return "শুভ সন্ধ্যা";
  return "শুভ রাত্রি";
};

const Dashboard = () => {
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const canEdit = user?.role !== "ACCOUNTS";

  const {
    employees,
    total,
    stats,
    loading: employeeLoading,
    error: employeeError,
  } = useAppSelector((state) => state.employees);

  const {
    departments,
    loading: departmentLoading,
    error: departmentError,
  } = useAppSelector((state) => state.departments);

  useEffect(() => {
    dispatch(fetchEmployees({ page: 1, limit: 100 }));
    dispatch(fetchDepartments({ status: "active" }));
  }, [dispatch]);

  // আজকের Attendance সারাংশ (Bangladesh তারিখ)
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceFailed, setAttendanceFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get("/daily-attendance", { params: { date: todayKey, limit: 1 } }),
      api.get("/leaves", { params: { status: "PENDING", limit: 1 } }),
    ])
      .then(([attendanceRes, leaveRes]) => {
        if (!active) return;
        setAttendanceSummary(attendanceRes.data.summary || null);
        setPendingLeaves(leaveRes.data.summary?.pending || 0);
        setAttendanceFailed(false);
        setUpdatedAt(new Date());
      })
      .catch(() => {
        if (!active) return;
        setAttendanceSummary(null);
        setAttendanceFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setAttendanceLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [todayKey, refreshKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  };

  const isLoading = employeeLoading || departmentLoading;
  const activeEmployees = stats?.active ?? 0;
  const inactiveEmployees = stats?.inactive ?? 0;

  const todayText = new Date().toLocaleDateString("bn-BD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

  const hasAttendance = Boolean(attendanceSummary) && attendanceSummary.total > 0;
  const dash = (value) => (hasAttendance ? value : "–");

  const attention = [
    { label: "ছুটির আবেদন অপেক্ষায়", value: pendingLeaves, to: "/leaves", tone: "text-amber-600" },
    { label: "আজ অনুপস্থিত", value: dash(attendanceSummary?.absent || 0), to: "/daily-attendance", tone: "text-rose-600" },
    { label: "এক পাঞ্চ, মিলছে না", value: dash(attendanceSummary?.incomplete || 0), to: "/daily-attendance", tone: "text-violet-600" },
  ];

  const workforce = [
    { label: "মোট কর্মী", value: stats?.total ?? total ?? employees.length, icon: Users },
    { label: "সক্রিয়", value: activeEmployees, icon: Users },
    { label: "নিষ্ক্রিয় / অন্যান্য", value: inactiveEmployees, icon: Users },
    { label: "বিভাগ", value: departments.length, icon: Building2 },
  ];

  const links = [
    canEdit && { to: "/employees", label: "নতুন কর্মী যোগ", icon: UserPlus, color: "bg-emerald-100 text-emerald-700" },
    { to: "/daily-attendance", label: "Daily Attendance", icon: Clock, color: "bg-amber-100 text-amber-700" },
    { to: "/weekly-roster", label: "Weekly Roster", icon: CalendarDays, color: "bg-blue-100 text-blue-700" },
    { to: "/leaves", label: "কর্মীর ছুটি", icon: CalendarOff, color: "bg-rose-100 text-rose-700", badge: pendingLeaves },
    { to: "/payroll", label: "Payroll", icon: Wallet, color: "bg-teal-100 text-teal-700" },
    { to: "/departments", label: "বিভাগ", icon: Building2, color: "bg-purple-100 text-purple-700" },
  ].filter(Boolean);

  return (
    <div className="font-dash space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {getGreeting()}
            {user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">গাজারিয়া এলাস্টিক ইন্ডাস্ট্রিজ লিমিটেড</p>
        </div>
        <p className="text-sm text-slate-600">{todayText}</p>
      </div>

      {(employeeError || departmentError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {employeeError || departmentError}
        </div>
      )}

      {/* আজকের উপস্থিতি: ড্যাশবোর্ডের মূল অংশ */}
      <AttendanceTape
        summary={attendanceSummary}
        loading={attendanceLoading}
        failed={attendanceFailed}
        refreshing={refreshing}
        updatedAt={updatedAt}
        onRefresh={handleRefresh}
      />

      {/* আজ যা দেখা দরকার */}
      <section aria-labelledby="attention-title" className={panel}>
        <h2 id="attention-title" className="px-5 pt-4 text-sm font-semibold text-slate-700">
          আজ যা দেখা দরকার
        </h2>
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {attention.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="group flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
            >
              <div>
                <p
                  className={`text-3xl font-semibold tabular-nums ${
                    item.value === 0 || item.value === "–" ? "text-slate-300" : item.tone
                  }`}
                >
                  {item.value}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{item.label}</p>
              </div>
              <ChevronRight size={18} className="text-slate-300 transition group-hover:text-slate-500" />
            </Link>
          ))}
        </div>
      </section>

      {/* কর্মী সংখ্যা */}
      <section aria-label="কর্মী ও বিভাগের সংখ্যা" className={`${panel} grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x`}>
        {workforce.map((item, i) => (
          <div
            key={item.label}
            className={`px-5 py-4 ${i > 1 ? "border-t border-slate-100 lg:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-slate-100 lg:border-l-0" : ""}`}
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {isLoading ? "…" : item.value}
            </p>
          </div>
        ))}
      </section>

      {/* বিভাগ + দ্রুত কাজ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DepartmentOverview departments={departments} employees={employees} />
        </div>

        <section aria-labelledby="quick-title" className={`${panel} self-start`}>
          <h2 id="quick-title" className="px-5 pt-4 text-sm font-semibold text-slate-700">
            দ্রুত কাজ
          </h2>
          <ul className="mt-2 divide-y divide-slate-100 pb-1">
            {links.map(({ to, label, icon: Icon, color, badge }) => (
              <li key={to + label}>
                <Link
                  to={to}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <span className={`rounded-lg p-2 ${color}`}>
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {badge}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-slate-300 transition group-hover:text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent Employees */}
      <RecentEmployees employees={employees} />
    </div>
  );
};

export default Dashboard;
