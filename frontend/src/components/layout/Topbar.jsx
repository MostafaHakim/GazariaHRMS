import { useEffect, useRef, useState } from "react";
import { Menu, Bell, Search, UserCircle, LogOut, KeyRound, ChevronDown, Loader2, X, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { logout, changePassword } from "../../features/auth/authSlice";
import { fetchCompanies, setActiveCompany } from "../../features/company/companySlice";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/employees": "Employee Management",
  "/departments": "Department Management",
  "/designations": "Designation Management",
  "/payroll": "Payroll",
  "/users": "Users & Roles",
  "/group-dashboard": "Group Dashboard",
  "/expenses": "Expense Management",
  "/payment-history": "Salary Payment History",
  "/audit-logs": "Audit Log",
  "/company-access": "User Company Access",
  "/companies": "Companies",
  "/devices": "Attendance Devices",
};

const ROLE_LABEL = { ADMIN: "Administrator", HR: "HR", ACCOUNTS: "Accounts" };

const ChangePasswordModal = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.newPassword.length < 8) return setError("New password must be at least 8 characters");
    if (form.newPassword !== form.confirm) return setError("Passwords do not match");
    setSaving(true);
    const res = await dispatch(changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
    setSaving(false);
    if (changePassword.rejected.match(res)) setError(res.payload);
    else setDone(true);
  };

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Change password</h2>
          <button type="button" onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        {done ? (
          <>
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password changed. Other devices have been signed out.</p>
            <button type="button" onClick={onClose} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white">Close</button>
          </>
        ) : (
          <>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <input type="password" placeholder="Current password" autoComplete="current-password" className={inputClass}
              value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
            <input type="password" placeholder="New password (min 8)" autoComplete="new-password" className={inputClass}
              value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            <input type="password" placeholder="Confirm new password" autoComplete="new-password" className={inputClass}
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving && <Loader2 size={15} className="animate-spin" />} Update password
            </button>
          </>
        )}
      </form>
    </div>
  );
};

const Topbar = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { companies, activeCompanyId, loading: companiesLoading } = useAppSelector((s) => s.company);
  const title = pageTitles[location.pathname] || "Gazaria HRMS";

  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>

        <div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">{title}</h2>
          <p className="hidden text-xs text-slate-400 sm:block">Gazaria HR Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="max-w-[190px] sm:max-w-[280px]">
          <label htmlFor="active-company" className="sr-only">Active company</label>
          <select id="active-company" value={activeCompanyId}
            disabled={companiesLoading || companies.length === 0}
            onChange={(e) => dispatch(setActiveCompany(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 sm:px-3 sm:text-sm"
            title="Select company">
            {companies.length === 0 && <option value="">No company available</option>}
            {companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
          </select>
        </div>
        {user?.role === "ADMIN" && (
          <button type="button" onClick={() => navigate("/companies")}
            className="rounded-lg border border-emerald-600 p-2 text-emerald-700 hover:bg-emerald-50"
            aria-label="Add company" title="নতুন কোম্পানি যোগ করুন">
            <Plus size={18} />
          </button>
        )}
        <button type="button" className="hidden rounded-lg border p-2 text-slate-500 hover:bg-slate-50 sm:block" aria-label="Search" title="Search">
          <Search size={19} />
        </button>

        <button type="button" className="relative rounded-lg border p-2 text-slate-500 hover:bg-slate-50" aria-label="Notifications" title="Notifications">
          <Bell size={19} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="relative border-l pl-3 sm:pl-4" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50">
            <UserCircle size={34} className="text-emerald-700" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user?.role] || user?.role}</p>
            </div>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border bg-white py-1 shadow-lg">
              <div className="border-b px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">@{user?.username}</p>
              </div>
              <button onClick={() => { setMenuOpen(false); setPwOpen(true); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <KeyRound size={16} /> Change password
              </button>
              <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </header>
  );
};

export default Topbar;
