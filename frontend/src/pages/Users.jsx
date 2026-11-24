import { useEffect, useState } from "react";
import { UserPlus, ShieldCheck, Loader2, X, KeyRound } from "lucide-react";

import api from "../services/api";
import { useAppSelector } from "../hooks/useAppSelector";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { fetchCompanies } from "../features/company/companySlice";

const ROLES = [
  { value: "ADMIN", label: "Group Admin", hint: "Everything, incl. users & payroll finalize/paid" },
  { value: "HR", label: "HR", hint: "All HR work + payroll generate/edit" },
  { value: "ACCOUNTS", label: "Accounts", hint: "Read-only + payroll export" },
  { value: "SECURITY", label: "Security (Punch app)", hint: "Only the mobile Punch app: gives IN / OUT for the employees selected below, cannot edit punches" },
];

const emptyForm = { name: "", username: "", email: "", role: "HR", password: "", companyAccess: [], defaultCompany: "", punchEmployees: [] };
const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-500";

const Users = () => {
  const me = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const { companies, activeCompanyId } = useAppSelector((s) => s.company);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // { mode: "create" | "edit", user? }
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [empOptions, setEmpOptions] = useState([]);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);

  useEffect(() => {
    let alive = true;
    api
      .get("/auth/users")
      .then(({ data }) => alive && setUsers(data.users))
      .catch((e) => alive && setError(e.response?.data?.message || "Failed to load users"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // SECURITY রোলে: নির্বাচিত কোম্পানির Active কর্মীর তালিকা (বাছাইয়ের জন্য)
  const secCompany = form.companyAccess[0] || "";
  useEffect(() => {
    if (!modal || form.role !== "SECURITY" || !secCompany) { setEmpOptions([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      api
        .get("/users/punch-employees", { params: { company: secCompany, search: empSearch || undefined } })
        .then(({ data }) => alive && setEmpOptions(data.employees || []))
        .catch(() => alive && setEmpOptions([]));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [modal, form.role, secCompany, empSearch]);

  const toggleEmp = (id) =>
    setForm((f) => ({ ...f, punchEmployees: f.punchEmployees.includes(id) ? f.punchEmployees.filter((x) => x !== id) : [...f.punchEmployees, id] }));

  const openCreate = () => { setForm({ ...emptyForm, companyAccess: activeCompanyId ? [activeCompanyId] : [], defaultCompany: activeCompanyId || "" }); setEmpSearch(""); setError(""); setModal({ mode: "create" }); };
  const openEdit = (u) => {
    setForm({ name: u.name, username: u.username, email: u.email || "", role: u.role, password: "", isActive: u.isActive, companyAccess: u.companyAccess || [], defaultCompany: u.defaultCompany || "", punchEmployees: u.punchEmployees || [] });
    setEmpSearch("");
    setError("");
    setModal({ mode: "edit", user: u });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (modal.mode === "create") {
        await api.post("/auth/users", form);
      } else {
        const body = { name: form.name, email: form.email, role: form.role, isActive: form.isActive, companyAccess: form.role === "ADMIN" ? [] : form.companyAccess, defaultCompany: form.role === "ADMIN" ? null : form.defaultCompany, punchEmployees: form.role === "SECURITY" ? form.punchEmployees : undefined };
        if (form.password) body.password = form.password;
        await api.put(`/auth/users/${modal.user.id}`, body);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const isSelf = modal?.mode === "edit" && modal.user.id === me?.id;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><ShieldCheck size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Users & Roles</h1>
            <p className="text-xs text-slate-500">Who can sign in to Gazaria HRMS</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {error && !modal && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Company Access</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={16} />Loading...</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}{u.role === "SECURITY" && <span className="ml-2 text-xs text-slate-400">· {u.punchEmployees?.length || 0} employees</span>}</td>
                <td className="px-4 py-3 text-slate-600">{u.username}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{u.role === "ADMIN" ? "Group Admin" : u.role}</span></td>
                <td className="px-4 py-3 text-xs text-slate-600">{u.role === "ADMIN" ? "All companies" : (u.companyAccess || []).map((id) => companies.find((company) => String(company._id) === String(id))?.name).filter(Boolean).join(", ") || "No access assigned"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{modal.mode === "create" ? "Add user" : `Edit ${modal.user.username}`}</h2>
              <button type="button" onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div><label className="mb-1 block text-sm font-medium">Full name</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            {modal.mode === "create" && (
              <div><label className="mb-1 block text-sm font-medium">Username</label>
                <input className={inputClass} value={form.username} minLength={3} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
            )}
            <div><label className="mb-1 block text-sm font-medium">Email (optional)</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm font-medium">Role</label>
              <select className={inputClass} value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{ROLES.find((r) => r.value === form.role)?.hint}</p></div>
            {form.role !== "ADMIN" && form.role !== "SECURITY" && (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Company access</p>
                  <p className="mb-2 text-xs text-slate-500">Select the companies this user is allowed to access.</p>
                  <div className="max-h-36 space-y-2 overflow-auto">
                    {companies.map((company) => (
                      <label key={company._id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={form.companyAccess.includes(String(company._id))}
                          onChange={(e) => {
                            const id = String(company._id);
                            const next = e.target.checked ? [...form.companyAccess, id] : form.companyAccess.filter((x) => x !== id);
                            setForm({ ...form, companyAccess: next, defaultCompany: next.includes(form.defaultCompany) ? form.defaultCompany : (next[0] || "") });
                          }} />
                        {company.name}
                      </label>
                    ))}
                    {companies.length === 0 && <p className="text-xs text-amber-700">No active companies found.</p>}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Default company</label>
                  <select className={inputClass} value={form.defaultCompany} onChange={(e) => setForm({ ...form, defaultCompany: e.target.value })} required>
                    <option value="">Select default company</option>
                    {companies.filter((company) => form.companyAccess.includes(String(company._id))).map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            {form.role === "SECURITY" && (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
                  <select className={inputClass} value={secCompany}
                    onChange={(e) => setForm({ ...form, companyAccess: e.target.value ? [e.target.value] : [], defaultCompany: e.target.value, punchEmployees: [] })} required>
                    <option value="">Select company</option>
                    {companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Employees allowed to punch ({form.punchEmployees.length} selected)</label>
                    <div className="flex gap-2 text-xs">
                      <button type="button" className="text-emerald-700 underline" onClick={() => setForm((f) => ({ ...f, punchEmployees: [...new Set([...f.punchEmployees, ...empOptions.map((o) => o._id)])] }))}>Select shown</button>
                      <button type="button" className="text-slate-500 underline" onClick={() => setForm((f) => ({ ...f, punchEmployees: [] }))}>Clear</button>
                    </div>
                  </div>
                  <input className={`${inputClass} mb-2`} placeholder="Search by name or ID" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} disabled={!secCompany} />
                  <div className="max-h-48 space-y-1.5 overflow-auto rounded-lg border bg-white p-2">
                    {empOptions.map((o) => (
                      <label key={o._id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={form.punchEmployees.includes(o._id)} onChange={() => toggleEmp(o._id)} />
                        {o.name} <span className="text-xs text-slate-400">({o.employeeId}{o.section ? ` · ${o.section}` : ""})</span>
                      </label>
                    ))}
                    {secCompany && empOptions.length === 0 && <p className="text-xs text-slate-400">No active employees found.</p>}
                    {!secCompany && <p className="text-xs text-amber-700">Select a company first.</p>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">This user logs in only on the Punch app and can give IN / OUT to these employees. Punches cannot be edited by them.</p>
                </div>
              </div>
            )}
            <div><label className="mb-1 flex items-center gap-1 text-sm font-medium"><KeyRound size={14} />{modal.mode === "create" ? "Password" : "New password (leave empty to keep)"}</label>
              <input type="password" autoComplete="new-password" className={inputClass} value={form.password} minLength={8}
                required={modal.mode === "create"} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters. Resetting a password signs that user out everywhere.</p></div>
            {modal.mode === "edit" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} disabled={isSelf} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Account active
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Users;
