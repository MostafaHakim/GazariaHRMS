import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  BriefcaseBusiness,
  Clock,
  CalendarDays,
  Wallet,
  FileBarChart,
  X,
  Factory,
  ChevronRight,
  Fingerprint,
  Router,
  CalendarDaysIcon,
  ClipboardCheck,
  CalendarRange,
  CalendarOff,
  ShieldCheck,
  HandCoins,
  Receipt,
  History,
  ClipboardList,
  Network,
  BarChart3,
} from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";

const menuGroups = [
  {
    title: "MAIN MENU",
    roles: ["ADMIN"],
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN"],
      },

      {
        label: "Group Dashboard",
        path: "/group-dashboard",
        icon: BarChart3,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "HR MANAGEMENT",
    roles: ["ADMIN", "HR"],
    items: [
      {
        label: "Employees",
        path: "/employees",
        icon: Users,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Departments",
        path: "/departments",
        icon: Building2,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Designations",
        path: "/designations",
        icon: BriefcaseBusiness,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Attendance",
        path: "/attendance",
        icon: Fingerprint,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Shifts",
        path: "/shifts",
        icon: Clock,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Attendance Devices",
        path: "/devices",
        icon: Router,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Roster Plan",
        path: "/roster-plan",
        icon: CalendarRange,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Weekly Roster",
        path: "/weekly-roster",
        icon: CalendarDaysIcon,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Daily Attendance",
        path: "/daily-attendance",
        icon: ClipboardCheck,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Monthly Attendance",
        path: "/monthly-attendance",
        icon: CalendarRange,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Holidays",
        path: "/holidays",
        icon: CalendarDays,
        roles: ["ADMIN", "HR"],
      },
      {
        label: "Job Card",
        path: "/job-card",
        icon: FileBarChart,
        roles: ["ADMIN", "HR"],
      },
    ],
  },
  {
    title: "LEAVE",
    roles: ["ADMIN", "HR"],
    items: [
      {
        label: "Leave Management",
        path: "/leaves",
        icon: CalendarOff,
        roles: ["ADMIN", "HR"],
      },
    ],
  },
  {
    title: "PAYROLL & REPORTS",
    roles: ["ADMIN", "HR", "ACCOUNTS"],
    items: [
      {
        label: "Payroll",
        path: "/payroll",
        icon: Wallet,
        roles: ["ADMIN", "HR", "ACCOUNTS"],
      },
      {
        label: "Advance & Loan",
        path: "/advances",
        icon: HandCoins,
        roles: ["ADMIN", "HR", "ACCOUNTS"],
      },
      {
        label: "Reports",
        path: "/reports",
        icon: FileBarChart,
        roles: ["ADMIN", "HR", "ACCOUNTS"],
      },
      {
        label: "Expenses",
        path: "/expenses",
        icon: Receipt,
        roles: ["ADMIN", "HR", "ACCOUNTS"],
      },
      {
        label: "Payment History",
        path: "/payment-history",
        icon: History,
        roles: ["ADMIN", "HR", "ACCOUNTS"],
      },
    ],
  },
  {
    title: "ADMINISTRATION",
    roles: ["ADMIN"],
    items: [
      {
        label: "Users & Roles",
        path: "/users",
        icon: ShieldCheck,
        roles: ["ADMIN"],
      },
      { label: "Companies", path: "/companies", icon: Factory },
      {
        label: "Company Access",
        path: "/company-access",
        icon: Network,
        roles: ["ADMIN"],
      },
      {
        label: "Audit Logs",
        path: "/audit-logs",
        icon: ClipboardList,
        roles: ["ADMIN"],
      },
    ],
  },
];

const Sidebar = ({ open, onClose }) => {
  const role = useAppSelector((s) => s.auth.user?.role);
  // const groups = menuGroups.map((g) => ({ ...g, items: g.items.filter((item) => (!g.adminOnly && !item.adminOnly) || role === "ADMIN") })).filter((g) => g.items.length > 0);
  const groups = menuGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          role === "ADMIN" || // অ্যাডমিন সব দেখে
          (g.roles.includes(role) && item.roles.includes(role)),
      ),
    }))
    .filter((g) => g.items.length > 0); // খালি গ্রুপ বাদ
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-slate-300 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500 p-2.5 text-white">
              <Factory size={24} />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">GAZARIA</h1>
              <p className="text-[10px] tracking-[3px] text-emerald-400">
                HR MANAGEMENT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6 overflow-y-auto scrollbar-none">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-3 text-[10px] font-semibold tracking-[2px] text-slate-500">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (item.disabled) {
                    return (
                      <div
                        key={item.label}
                        className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-3 text-sm text-slate-500"
                        title="Coming soon"
                      >
                        <span className="flex items-center gap-3">
                          <Icon size={18} />
                          {item.label}
                        </span>
                        <span className="text-[9px]">SOON</span>
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-lg px-3 py-3 text-sm transition ${
                          isActive
                            ? "bg-emerald-500 font-medium text-white shadow-lg shadow-emerald-950/30"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`
                      }
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={18} />
                        {item.label}
                      </span>
                      <ChevronRight size={15} />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs font-medium text-white">
              Gazaria Elastic Industries
            </p>
            <p className="mt-1 text-[10px] text-slate-500">HRMS Version 2.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
