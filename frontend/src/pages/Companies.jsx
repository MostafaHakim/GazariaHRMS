import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import api from "../services/api";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { fetchCompanies, setActiveCompany } from "../features/company/companySlice";

const empty = { name: "", code: "", legalName: "", address: "", phone: "", email: "" };
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export default function Companies() {
  const dispatch = useAppDispatch();
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);

  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/companies", { params: { all: 1 } });
      setCompanies(data.companies || []);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "কোম্পানির তালিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((v) => ({ ...v, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (editingId) {
        await api.patch(`/companies/${editingId}`, form);
        setMessage("কোম্পানির তথ্য আপডেট হয়েছে");
      } else {
        await api.post("/companies", form);
        setMessage("নতুন কোম্পানি যোগ হয়েছে। এখন উপরের Company মেনু থেকে সিলেক্ট করে ডিভাইস, Department ও Employee যোগ করুন।");
      }
      setForm(empty);
      setEditingId("");
      await load();
      dispatch(fetchCompanies()); // উপরের Company dropdown হালনাগাদ
    } catch (err) {
      setError(err.response?.data?.message || "সংরক্ষণ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c._id);
    setForm({
      name: c.name || "",
      code: c.code || "",
      legalName: c.legalName || "",
      address: c.address || "",
      phone: c.phone || "",
      email: c.email || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(empty);
  };

  const toggleActive = async (c) => {
    const next = !c.isActive;
    if (!next && !window.confirm(`"${c.name}" নিষ্ক্রিয় করবেন? ডেটা মুছবে না, কিন্তু কোম্পানিটি মেনুতে আর দেখা যাবে না।`)) return;
    setError("");
    try {
      await api.patch(`/companies/${c._id}`, { isActive: next });
      await load();
      dispatch(fetchCompanies());
    } catch (err) {
      setError(err.response?.data?.message || "পরিবর্তন করা যায়নি");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-bold text-slate-800">Companies</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">গ্রুপের কোম্পানি যোগ ও সম্পাদনা করুন (শুধু Group Admin)</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-3">
        <h2 className="flex items-center gap-2 font-semibold md:col-span-3">
          <Plus size={18} />
          {editingId ? "কোম্পানি Edit" : "নতুন কোম্পানি যোগ করুন"}
        </h2>

        <label className="text-sm text-slate-600">
          Company Name*
          <input required value={form.name} onChange={(e) => setField("name", e.target.value)} className={inputClass} placeholder="Gazaria Packaging Limited" />
        </label>
        <label className="text-sm text-slate-600">
          Company Code* (ছোট ও ইউনিক)
          <input required value={form.code} onChange={(e) => setField("code", e.target.value.toUpperCase())} className={inputClass} placeholder="GPL" />
        </label>
        <label className="text-sm text-slate-600">
          Legal Name
          <input value={form.legalName} onChange={(e) => setField("legalName", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm text-slate-600 md:col-span-3">
          Address
          <input value={form.address} onChange={(e) => setField("address", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm text-slate-600">
          Phone
          <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm text-slate-600">
          Email
          <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputClass} />
        </label>

        <div className="flex gap-2 md:col-span-3">
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Save size={16} />
            {saving ? "Saving..." : editingId ? "Update Company" : "Add Company"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {["Company", "Code", "Contact", "Status", "Actions"].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-500">
                  কোনো কোম্পানি নেই
                </td>
              </tr>
            ) : (
              companies.map((c) => {
                const isActiveNow = String(c._id) === String(activeCompanyId);
                return (
                  <tr key={c._id} className="border-t">
                    <td className="p-3">
                      <b className="text-slate-800">{c.name}</b>
                      {c.legalName && <div className="text-xs text-slate-500">{c.legalName}</div>}
                    </td>
                    <td className="p-3">{c.code}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {c.isActive && (
                          <button
                            onClick={() => dispatch(setActiveCompany(c._id))}
                            disabled={isActiveNow}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 disabled:opacity-60"
                          >
                            {isActiveNow ? (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600" /> Selected
                              </>
                            ) : (
                              "Select"
                            )}
                          </button>
                        )}
                        <button onClick={() => startEdit(c)} className="rounded border px-2 py-1">
                          Edit
                        </button>
                        <button onClick={() => toggleActive(c)} className={`rounded border px-2 py-1 ${c.isActive ? "text-red-600" : "text-emerald-700"}`}>
                          {c.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        নতুন কোম্পানিতে Group Admin-এর Access স্বয়ংক্রিয়ভাবে থাকে। HR/Accounts ইউজারকে দিতে হলে Company Access পেজ ব্যবহার করুন।
      </p>
    </div>
  );
}
