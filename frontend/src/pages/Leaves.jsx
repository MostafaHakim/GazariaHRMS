import { useCallback, useEffect, useState } from "react";
import {
  CalendarOff,
  Plus,
  Search,
  RefreshCw,
  Check,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import api from "../services/api";
import { useAppSelector } from "../hooks/useAppSelector";

const LEAVE_TYPES = {
  CASUAL: "Casual (নৈমিত্তিক)",
  SICK: "Sick (অসুস্থতা)",
  ANNUAL: "Annual (বার্ষিক)",
  MATERNITY: "Maternity (মাতৃত্বকালীন)",
  UNPAID: "Unpaid (বেতনহীন)",
  OTHER: "Other (অন্যান্য)",
};

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

// Bangladesh আজকের তারিখ (YYYY-MM-DD)
const getToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "-";

const emptyForm = () => ({
  employee: null,
  leaveType: "CASUAL",
  fromDate: getToday(),
  toDate: getToday(),
  reason: "",
  status: "APPROVED",
});

const Leaves = () => {
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);
  const [leaves, setLeaves] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [month, setMonth] = useState(getToday().slice(0, 7));
  const [status, setStatus] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Add leave modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadLeaves = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/leaves", {
          params: {
            page: pageNo,
            limit: 50,
            ...(month ? { month } : {}),
            ...(status ? { status } : {}),
            ...(leaveType ? { leaveType } : {}),
            ...(section ? { section } : {}),
            ...(search.trim() ? { employeeId: search.trim() } : {}),
          },
        });
        setLeaves(res.data.data || []);
        setSummary(res.data.summary || {});
        setPagination(res.data.pagination || { page: 1, totalPages: 1 });
      } catch (err) {
        setError(err.response?.data?.message || "Leave list load failed");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, status, leaveType, section, page, activeCompanyId],
  );

  useEffect(() => {
    loadLeaves(page);
  }, [loadLeaves, page]);

  useEffect(() => {
    api
      .get("/employees", { params: { limit: 1 } })
      .then((res) => setSections(res.data.sections || []))
      .catch(() => {});
  }, [activeCompanyId]);

  // কর্মী খোঁজা (modal)
  useEffect(() => {
    if (!showForm || empSearch.trim().length < 1) {
      setEmpResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/employees", {
          params: { search: empSearch.trim(), status: "Active", limit: 8 },
        });
        setEmpResults(res.data.employees || []);
      } catch {
        setEmpResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [empSearch, showForm, activeCompanyId]);

  const openForm = () => {
    setForm(emptyForm());
    setEmpSearch("");
    setEmpResults([]);
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.employee) {
      setFormError("কর্মী নির্বাচন করুন");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const res = await api.post("/leaves", {
        employee: form.employee._id,
        leaveType: form.leaveType,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
        status: form.status,
      });
      setShowForm(false);
      setMessage(res.data.message || "ছুটি সংরক্ষণ হয়েছে");
      setPage(1);
      loadLeaves(1);
    } catch (err) {
      setFormError(err.response?.data?.message || "ছুটি সংরক্ষণ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (leave, newStatus) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/leaves/${leave._id}/status`, { status: newStatus });
      setMessage(`${leave.employeeName} এর ছুটি ${newStatus} করা হয়েছে`);
      loadLeaves(page);
    } catch (err) {
      setError(err.response?.data?.message || "Status update failed");
    }
  };

  const removeLeave = async (leave) => {
    if (!window.confirm(`${leave.employeeName} এর এই ছুটির রেকর্ড মুছে ফেলবেন?`)) {
      return;
    }
    setMessage("");
    setError("");
    try {
      await api.delete(`/leaves/${leave._id}`);
      setMessage("ছুটির রেকর্ড মুছে ফেলা হয়েছে");
      loadLeaves(page);
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <CalendarOff className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-bold text-gray-800">
              Worker Leave Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            কর্মীদের ছুটি দিন ও অনুমোদন করুন। Approved ছুটির দিনে পাঞ্চ না থাকলে
            Daily Attendance-এ Absent এর বদলে Leave দেখাবে।
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadLeaves(page)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={openForm}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Add Leave
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Total Records", summary.total || 0, "text-blue-700 bg-blue-50"],
          ["Pending", summary.pending || 0, "text-amber-700 bg-amber-50"],
          ["Approved", summary.approved || 0, "text-green-700 bg-green-50"],
          ["Approved Days", summary.approvedDays || 0, "text-purple-700 bg-purple-50"],
        ].map(([title, value, color]) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{title}</p>
            <h3 className={`mt-2 inline-block rounded-lg px-3 py-1 text-2xl font-bold ${color}`}>
              {value}
            </h3>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={leaveType}
            onChange={(e) => {
              setLeaveType(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Leave Types</option>
            {Object.entries(LEAVE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__NONE__">Section নেই</option>
          </select>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name / Employee ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  loadLeaves(1);
                }
              }}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">SL</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-gray-500">
                    <Loader2 className="mx-auto animate-spin" size={20} />
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-gray-500">
                    কোনো ছুটির রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                leaves.map((leave, index) => (
                  <tr key={leave._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">
                      {(pagination.page - 1) * 50 + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{leave.employeeName}</p>
                      <p className="text-xs text-gray-400">{leave.employeeId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{leave.employee?.section || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {LEAVE_TYPES[leave.leaveType] || leave.leaveType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(leave.fromDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(leave.toDate)}</td>
                    <td className="px-4 py-3 font-medium">{leave.totalDays}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-500" title={leave.reason}>
                      {leave.reason || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[leave.status] || ""
                        }`}
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {leave.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => changeStatus(leave, "APPROVED")}
                              title="Approve"
                              className="rounded-lg bg-green-600 p-1.5 text-white hover:bg-green-700"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => changeStatus(leave, "REJECTED")}
                              title="Reject"
                              className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {leave.status === "APPROVED" && (
                          <button
                            onClick={() => changeStatus(leave, "CANCELLED")}
                            title="Cancel leave"
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => removeLeave(leave)}
                          title="Delete"
                          className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 p-4 text-xs text-gray-500">
          <span>
            Page {pagination.page || 1} of {pagination.totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              disabled={loading || (pagination.page || 1) <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={loading || (pagination.page || 1) >= (pagination.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Leave Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">নতুন ছুটি যোগ করুন</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              {/* Employee picker */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">কর্মী</label>
                {form.employee ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                    <span>
                      <b>{form.employee.name}</b> ({form.employee.employeeId})
                      {form.employee.section ? ` · ${form.employee.section}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, employee: null }))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="নাম বা Employee ID লিখে খুঁজুন"
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className={inputClass}
                    />
                    {empResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {empResults.map((emp) => (
                          <button
                            type="button"
                            key={emp._id}
                            onClick={() => {
                              setForm((f) => ({ ...f, employee: emp }));
                              setEmpResults([]);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium">{emp.name}</span>
                            <span className="text-xs text-gray-400">
                              {emp.employeeId}
                              {emp.section ? ` · ${emp.section}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">শুরুর তারিখ</label>
                  <input
                    type="date"
                    required
                    value={form.fromDate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        fromDate: e.target.value,
                        toDate: f.toDate < e.target.value ? e.target.value : f.toDate,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">শেষ তারিখ</label>
                  <input
                    type="date"
                    required
                    min={form.fromDate}
                    value={form.toDate}
                    onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">ছুটির ধরন</label>
                  <select
                    value={form.leaveType}
                    onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
                    className={inputClass}
                  >
                    {Object.entries(LEAVE_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="APPROVED">Approved (সরাসরি অনুমোদিত)</option>
                    <option value="PENDING">Pending (অনুমোদনের অপেক্ষায়)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">কারণ (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-500">
                শুক্রবার (সাপ্তাহিক ছুটি) ছুটির দিনের হিসাবে ধরা হয় না।
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Leaves;
