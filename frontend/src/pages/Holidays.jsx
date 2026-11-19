import { useEffect, useState } from "react";
import { Plus, Trash2, Calendar, X, RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { fetchDepartments } from "../features/departments/departmentSlice";

const emptyForm = {
  date: "",
  name: "",
  type: "GLOBAL",
  religions: [],
  departments: [],
  excludeDepartments: [],
  otIfWorked: true,
  isActive: true,
  remarks: "",
};

const RELIGIONS = ["Hindu", "Muslim", "Christian", "Buddhist", "Other"];

const Holidays = () => {
  const dispatch = useAppDispatch();
  const departments = useAppSelector((s) => s.departments.departments) || [];
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/holidays", { params: { year } });
      setHolidays(res.data.holidays || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchDepartments({ status: "active" }));
  }, [dispatch, activeCompanyId]);

  useEffect(() => {
    load();
  }, [year, activeCompanyId]);

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/holidays", form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      await api.delete(`/holidays/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const toggleReligion = (r) => {
    setForm((prev) => {
      const set = new Set(prev.religions);
      if (set.has(r)) set.delete(r);
      else set.add(r);
      return { ...prev, religions: Array.from(set) };
    });
  };

  const toggleDept = (field, id) => {
    setForm((prev) => {
      const set = new Set(prev[field].map(String));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const formatDate = (d) => {
    if (!d) return "-";
    return String(d).slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-emerald-600" size={26} />
            Holidays
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Friday is always weekly off. Declare other holidays here (global or
            by religion / department).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            Add Holiday
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Note:</strong> Every <strong>Friday</strong> is automatic weekly
        off. If someone punches on Friday, all worked time counts as OT. Use
        this page only for other holidays (Eid, Puja, National days, etc.).
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Religions</th>
              <th className="p-3">OT if worked</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-500">
                  No holidays for {year}
                </td>
              </tr>
            ) : (
              holidays.map((h) => (
                <tr key={h._id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{formatDate(h.date)}</td>
                  <td className="p-3">{h.name}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        h.type === "GLOBAL"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {h.type}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {h.religions?.length
                      ? h.religions.join(", ")
                      : h.type === "GLOBAL"
                        ? "All"
                        : "-"}
                  </td>
                  <td className="p-3">{h.otIfWorked ? "Yes" : "No"}</td>
                  <td className="p-3">
                    {h.isActive ? (
                      <span className="text-emerald-600">Active</span>
                    ) : (
                      <span className="text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(h._id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold">Add Holiday</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Durga Puja Day 1"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="GLOBAL">Global (everyone)</option>
                  <option value="CONDITIONAL">
                    Conditional (religion / dept)
                  </option>
                </select>
              </div>

              {form.type === "CONDITIONAL" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Religions (empty = all)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RELIGIONS.map((r) => (
                      <label
                        key={r}
                        className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={form.religions.includes(r)}
                          onChange={() => toggleReligion(r)}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Exclude Departments (e.g. Security)
                </label>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                  {departments.map((d) => (
                    <label
                      key={d._id}
                      className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={form.excludeDepartments
                          .map(String)
                          .includes(d._id)}
                        onChange={() =>
                          toggleDept("excludeDepartments", d._id)
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.otIfWorked}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, otIfWorked: e.target.checked }))
                  }
                />
                If worked, count as OT
              </label>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Holiday"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Holidays;
