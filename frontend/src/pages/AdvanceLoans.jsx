import { useCallback, useEffect, useState } from "react";
import {
  HandCoins, Plus, Search, RefreshCw, Check, X, Trash2, AlertCircle, CheckCircle2,
  Loader2, Eye, Ban, Lock, Pencil,
} from "lucide-react";

import api from "../services/api";
import { useAppSelector } from "../hooks/useAppSelector";

const TYPES = { ADVANCE: "Advance (অগ্রিম)", LOAN: "Loan (ঋণ)" };

const CATEGORIES = {
  SALARY_ADVANCE: "Salary Advance (বেতন অগ্রিম)",
  MEDICAL: "Medical (চিকিৎসা)",
  EMERGENCY: "Emergency (জরুরি)",
  FESTIVAL: "Festival (উৎসব)",
  HOUSING: "Housing (বাসা/ভাড়া)",
  EDUCATION: "Education (শিক্ষা)",
  PERSONAL: "Personal (ব্যক্তিগত)",
  OTHER: "Other (অন্যান্য)",
};

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  CLOSED: "bg-blue-100 text-blue-700",
};

const STATUS_TABS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["APPROVED", "Active"],
  ["CLOSED", "Closed"],
  ["REJECTED", "Rejected"],
  ["CANCELLED", "Cancelled"],
];

const getToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : "-";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m) => {
  if (!m) return "-";
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1]} ${y}`;
};

const money = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const emptyForm = () => ({
  employee: null,
  type: "ADVANCE",
  category: "SALARY_ADVANCE",
  amount: "",
  installments: 1,
  startMonth: getToday().slice(0, 7),
  issueDate: getToday(),
  reason: "",
  approveNow: false,
});

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const perInstallment = (amount, n) => {
  const a = Number(amount);
  const k = Math.max(1, Math.floor(Number(n) || 1));
  if (!(a > 0)) return null;
  const base = Math.floor((a * 100) / k) / 100;
  const last = Math.round((a - base * (k - 1)) * 100) / 100;
  return { base, last, k };
};

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
    <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-xl bg-white p-5 shadow-xl`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-gray-800">{title}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children, hint }) => (
  <div>
    <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
  </div>
);

const ErrorBox = ({ text }) =>
  text ? (
    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{text}</div>
  ) : null;

const AdvanceLoans = () => {
  const user = useAppSelector((s) => s.auth.user);
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);
  const canApprove = user?.role === "ADMIN" || user?.role === "ACCOUNTS";

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // modal: { kind: "form" | "approve" | "reject" | "close" | "detail", item? }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState([]);
  const [actionForm, setActionForm] = useState({ note: "", startMonth: "", installments: 1 });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const load = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/advances", {
          params: {
            page: pageNo,
            limit: 50,
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
            ...(month ? { month } : {}),
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        });
        setItems(res.data.data || []);
        setSummary(res.data.summary || {});
        setPagination(res.data.pagination || { page: 1, totalPages: 1 });
      } catch (err) {
        setError(err.response?.data?.message || "তালিকা লোড করা যায়নি");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, type, month, page, activeCompanyId],
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);

  // কর্মী খোঁজা (নতুন এন্ট্রি ফর্মে)
  useEffect(() => {
    if (modal?.kind !== "form" || modal.item || empSearch.trim().length < 1) return undefined;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/employees", { params: { search: empSearch.trim(), status: "Active", limit: 8 } });
        setEmpResults(res.data.employees || []);
      } catch {
        setEmpResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [empSearch, modal]);

  const shownEmpResults = modal?.kind === "form" && !modal.item && empSearch.trim() ? empResults : [];

  const closeModal = () => {
    setModal(null);
    setModalError("");
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEmpSearch("");
    setEmpResults([]);
    setModalError("");
    setModal({ kind: "form" });
  };

  const openEdit = (item) => {
    setForm({
      employee: { _id: item.employee, name: item.employeeName, employeeId: item.employeeId, section: item.section },
      type: item.type,
      category: item.category,
      amount: item.amount,
      installments: item.installments,
      startMonth: item.startMonth,
      issueDate: item.issueDate ? item.issueDate.slice(0, 10) : "",
      reason: item.reason || "",
      approveNow: false,
    });
    setModalError("");
    setModal({ kind: "form", item });
  };

  const openAction = (kind, item) => {
    setActionForm({ note: "", startMonth: item.startMonth, installments: item.installments });
    setModalError("");
    setModal({ kind, item });
  };

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const changeType = (t) =>
    setF({ type: t, installments: t === "ADVANCE" ? 1 : form.installments > 1 ? form.installments : 6 });

  // ---- সেভ / অ্যাকশন ----
  const run = async (fn, successFallback) => {
    setSaving(true);
    setModalError("");
    try {
      const res = await fn();
      closeModal();
      setMessage(res.data?.message || successFallback);
      load(page);
    } catch (err) {
      setModalError(err.response?.data?.message || "অপারেশন ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.employee) {
      setModalError("কর্মী নির্বাচন করুন");
      return;
    }
    const payload = {
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      installments: Number(form.installments) || 1,
      startMonth: form.startMonth,
      issueDate: form.issueDate || undefined,
      reason: form.reason,
    };
    if (modal.item) {
      run(() => api.put(`/advances/${modal.item._id}`, payload), "আপডেট হয়েছে");
    } else {
      run(
        () => api.post("/advances", { ...payload, employee: form.employee._id, approveNow: canApprove && form.approveNow }),
        "এন্ট্রি জমা হয়েছে",
      );
    }
  };

  const handleApprove = (e) => {
    e.preventDefault();
    run(
      () =>
        api.patch(`/advances/${modal.item._id}/approve`, {
          note: actionForm.note,
          startMonth: actionForm.startMonth,
          installments: Number(actionForm.installments) || 1,
        }),
      "অনুমোদিত",
    );
  };

  const handleReject = (e) => {
    e.preventDefault();
    run(() => api.patch(`/advances/${modal.item._id}/reject`, { note: actionForm.note }), "প্রত্যাখ্যান করা হয়েছে");
  };

  const handleClose = (e) => {
    e.preventDefault();
    run(() => api.patch(`/advances/${modal.item._id}/close`, { note: actionForm.note }), "ক্লোজ করা হয়েছে");
  };

  const quick = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage("");
    setError("");
    try {
      const res = await fn();
      setMessage(res.data?.message || "সম্পন্ন");
      load(page);
    } catch (err) {
      setError(err.response?.data?.message || "অপারেশন ব্যর্থ হয়েছে");
    }
  };

  const isOwner = (item) => String(item.requestedBy) === String(user?.id);
  const canEditItem = (item) => item.status === "PENDING" && (canApprove || isOwner(item));

  const preview = perInstallment(modal?.kind === "approve" ? modal.item.amount : form.amount, modal?.kind === "approve" ? actionForm.installments : form.installments);

  const cards = [
    ["Pending Approval", `${summary.pendingCount || 0}`, `৳ ${money(summary.pendingAmount)}`, "text-amber-700 bg-amber-50"],
    ["Active Records", `${summary.activeCount || 0}`, "চলমান কিস্তি", "text-green-700 bg-green-50"],
    ["Total Outstanding", `৳ ${money(summary.outstanding)}`, "এখনো কাটা বাকি", "text-purple-700 bg-purple-50"],
    [`Deduction · ${monthLabel(summary.month)}`, `৳ ${money(summary.monthDeduction)}`, "এই মাসের পেরোলে", "text-blue-700 bg-blue-50"],
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <HandCoins className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-bold text-gray-800">Advance &amp; Loan</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            HR / Admin / Accounts এন্ট্রি দেবে → Accounts অনুমোদন করলে কিস্তি পেরোল শিটের{" "}
            <b>Adv/Loan</b> কলামে যোগ হবে এবং Net Payable থেকে কাটা যাবে।
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={16} /> New Entry
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([title, value, sub, color]) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{title}</p>
            <h3 className={`mt-2 inline-block rounded-lg px-3 py-1 text-xl font-bold ${color}`}>{value}</h3>
            <p className="mt-1 text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map(([key, label]) => (
            <button
              key={key || "all"}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                status === key ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
              {key === "PENDING" && summary.pendingCount > 0 ? ` (${summary.pendingCount})` : ""}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className={inputClass}
            title="এই মাসে কিস্তি আছে এমন রেকর্ড"
          />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name / Employee ID (Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  load(1);
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
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">SL</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Recovered</th>
                <th className="px-4 py-3">Entry By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-500">
                    <Loader2 className="mx-auto animate-spin" size={20} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-500">কোনো রেকর্ড পাওয়া যায়নি।</td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const pct = item.amount > 0 ? Math.min(100, Math.round((item.recovered / item.amount) * 100)) : 0;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{(pagination.page - 1) * 50 + index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{item.employeeName}</p>
                        <p className="text-xs text-gray-400">
                          {item.employeeId}
                          {item.section ? ` · ${item.section}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            item.type === "LOAN" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {item.type === "LOAN" ? "Loan" : "Advance"}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">{(CATEGORIES[item.category] || item.category).split(" (")[0]}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">৳ {money(item.amount)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.installments} × ৳ {money(item.installmentAmount)}
                        <p className="text-gray-400">শুরু: {monthLabel(item.startMonth)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "PENDING" || item.status === "REJECTED" || item.status === "CANCELLED" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <div className="w-32">
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              ৳ {money(item.recovered)} / {money(item.amount)}
                            </p>
                            {item.status === "APPROVED" && (
                              <p className="text-[11px] text-purple-600">বাকি ৳ {money(item.outstanding)}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.requestedByName || "-"}
                        <p className="text-gray-400">{item.requestedByRole} · {formatDate(item.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[item.status] || ""}`}>
                          {item.status}
                        </span>
                        {item.decidedByName && item.status !== "PENDING" && (
                          <p className="mt-1 text-[11px] text-gray-400">by {item.decidedByName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {item.status === "PENDING" && canApprove && (
                            <>
                              <button onClick={() => openAction("approve", item)} title="Approve"
                                className="rounded-lg bg-green-600 p-1.5 text-white hover:bg-green-700">
                                <Check size={14} />
                              </button>
                              <button onClick={() => openAction("reject", item)} title="Reject"
                                className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600">
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {canEditItem(item) && (
                            <button onClick={() => openEdit(item)} title="Edit"
                              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                              <Pencil size={14} />
                            </button>
                          )}
                          <button onClick={() => setModal({ kind: "detail", item })} title="Details / Schedule"
                            className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                            <Eye size={14} />
                          </button>
                          {item.status === "APPROVED" && canApprove && (
                            <>
                              {!item.schedule?.some((s) => s.deducted) && (
                                <button
                                  onClick={() => quick(() => api.patch(`/advances/${item._id}/cancel`), "অনুমোদন বাতিল করবেন? (কোনো কিস্তি এখনো কাটা হয়নি)")}
                                  title="Cancel approval"
                                  className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                                  <Ban size={14} />
                                </button>
                              )}
                              <button onClick={() => openAction("close", item)} title="Close — বাকি কিস্তি আর কাটা হবে না"
                                className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                                <Lock size={14} />
                              </button>
                            </>
                          )}
                          {item.status === "PENDING" && !canApprove && isOwner(item) && (
                            <button
                              onClick={() => quick(() => api.patch(`/advances/${item._id}/cancel`), "এন্ট্রি বাতিল করবেন?")}
                              title="Cancel"
                              className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                              <Ban size={14} />
                            </button>
                          )}
                          {(item.status === "PENDING" && (canApprove || isOwner(item))) ||
                          (["REJECTED", "CANCELLED"].includes(item.status) && user?.role === "ADMIN") ? (
                            <button
                              onClick={() => quick(() => api.delete(`/advances/${item._id}`), `${item.employeeName} এর এই রেকর্ড মুছে ফেলবেন?`)}
                              title="Delete"
                              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 p-4 text-xs text-gray-500">
          <span>Page {pagination.page || 1} of {pagination.totalPages || 1}</span>
          <div className="flex gap-2">
            <button disabled={loading || (pagination.page || 1) <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={loading || (pagination.page || 1) >= (pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* ---------- Create / Edit ---------- */}
      {modal?.kind === "form" && (
        <Modal title={modal.item ? "এন্ট্রি এডিট করুন" : "নতুন Advance / Loan এন্ট্রি"} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-3">
            <ErrorBox text={modalError} />

            <Field label="কর্মী">
              {form.employee ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                  <span>
                    <b>{form.employee.name}</b> ({form.employee.employeeId})
                    {form.employee.section ? ` · ${form.employee.section}` : ""}
                  </span>
                  {!modal.item && (
                    <button type="button" onClick={() => setF({ employee: null })} className="text-gray-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="নাম বা ID লিখে খুঁজুন"
                    className={inputClass}
                    autoFocus
                  />
                  {shownEmpResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                      {shownEmpResults.map((emp) => (
                        <button
                          type="button"
                          key={emp._id}
                          onClick={() => {
                            setF({ employee: emp });
                            setEmpSearch("");
                            setEmpResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                        >
                          <b>{emp.name}</b> ({emp.employeeId}){emp.section ? ` · ${emp.section}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ধরন">
                <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
                  {Object.entries({ ADVANCE: "Advance", LOAN: "Loan" }).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => changeType(k)}
                      className={`flex-1 px-3 py-2 ${form.type === k ? "bg-emerald-600 font-semibold text-white" : "bg-white text-gray-600"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="ক্যাটাগরি">
                <select value={form.category} onChange={(e) => setF({ category: e.target.value })} className={inputClass}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="টাকার পরিমাণ (৳)">
                <input type="number" min="1" step="0.01" required value={form.amount}
                  onChange={(e) => setF({ amount: e.target.value })} className={inputClass} />
              </Field>
              <Field label="কিস্তির সংখ্যা" hint={form.type === "ADVANCE" ? "অ্যাডভান্স সাধারণত ১ কিস্তি (এক মাসেই কাটা)" : undefined}>
                <input type="number" min="1" max="36" required value={form.installments}
                  onChange={(e) => setF({ installments: e.target.value })} className={inputClass} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="প্রথম কিস্তি কাটার মাস">
                <input type="month" required value={form.startMonth}
                  onChange={(e) => setF({ startMonth: e.target.value })} className={inputClass} />
              </Field>
              <Field label="টাকা দেওয়ার তারিখ">
                <input type="date" value={form.issueDate} onChange={(e) => setF({ issueDate: e.target.value })} className={inputClass} />
              </Field>
            </div>

            {preview && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                প্রতি কিস্তি ≈ <b>৳ {money(preview.base)}</b>
                {preview.k > 1 && preview.last !== preview.base ? ` (শেষ কিস্তি ৳ ${money(preview.last)})` : ""} · {preview.k} মাস
              </p>
            )}

            <Field label="কারণ / নোট">
              <textarea rows={2} value={form.reason} onChange={(e) => setF({ reason: e.target.value })} className={inputClass} />
            </Field>

            {canApprove && !modal.item && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.approveNow} onChange={(e) => setF({ approveNow: e.target.checked })} />
                জমা দিয়েই এখনই অনুমোদন করুন
              </label>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">বাতিল</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {modal.item ? "আপডেট" : form.approveNow && canApprove ? "জমা ও অনুমোদন" : "জমা দিন"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Approve ---------- */}
      {modal?.kind === "approve" && (
        <Modal title="অনুমোদন দিন" onClose={closeModal}>
          <form onSubmit={handleApprove} className="space-y-3">
            <ErrorBox text={modalError} />
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p><b>{modal.item.employeeName}</b> ({modal.item.employeeId})</p>
              <p className="text-gray-600">
                {modal.item.type === "LOAN" ? "Loan" : "Advance"} · ৳ {money(modal.item.amount)}
                {modal.item.reason ? ` · ${modal.item.reason}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="প্রথম কিস্তির মাস">
                <input type="month" required value={actionForm.startMonth}
                  onChange={(e) => setActionForm((f) => ({ ...f, startMonth: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="কিস্তির সংখ্যা">
                <input type="number" min="1" max="36" required value={actionForm.installments}
                  onChange={(e) => setActionForm((f) => ({ ...f, installments: e.target.value }))} className={inputClass} />
              </Field>
            </div>
            {preview && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                প্রতি কিস্তি ≈ <b>৳ {money(preview.base)}</b>
                {preview.k > 1 && preview.last !== preview.base ? ` (শেষ কিস্তি ৳ ${money(preview.last)})` : ""} · {preview.k} মাস
              </p>
            )}
            <Field label="নোট (ঐচ্ছিক)">
              <input value={actionForm.note} onChange={(e) => setActionForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} />
            </Field>
            <p className="text-xs text-gray-500">
              অনুমোদনের পর কিস্তিটি ঐ মাসের পেরোল শিটে স্বয়ংক্রিয়ভাবে যোগ হবে (Draft থাকলে সাথে সাথে, না থাকলে Generate করলে)।
              পেরোল <b>Mark Paid</b> হলে কিস্তি &quot;কাটা হয়েছে&quot; হিসেবে চিহ্নিত হবে।
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">বন্ধ</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} অনুমোদন
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Reject / Close ---------- */}
      {(modal?.kind === "reject" || modal?.kind === "close") && (
        <Modal title={modal.kind === "reject" ? "প্রত্যাখ্যান করুন" : "রেকর্ড ক্লোজ করুন"} onClose={closeModal}>
          <form onSubmit={modal.kind === "reject" ? handleReject : handleClose} className="space-y-3">
            <ErrorBox text={modalError} />
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p><b>{modal.item.employeeName}</b> ({modal.item.employeeId}) · ৳ {money(modal.item.amount)}</p>
              {modal.kind === "close" && (
                <p className="mt-1 text-xs text-gray-600">
                  কাটা হয়েছে ৳ {money(modal.item.recovered)}, বাকি ৳ {money(modal.item.outstanding)} — ক্লোজ করলে বাকি কিস্তি আর পেরোলে আসবে না।
                </p>
              )}
            </div>
            <Field label={modal.kind === "reject" ? "প্রত্যাখ্যানের কারণ" : "ক্লোজের কারণ (যেমন: নগদে পরিশোধ / মওকুফ)"}>
              <textarea rows={2} required value={actionForm.note}
                onChange={(e) => setActionForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">বন্ধ</button>
              <button type="submit" disabled={saving}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  modal.kind === "reject" ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-800"
                }`}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {modal.kind === "reject" ? "প্রত্যাখ্যান" : "ক্লোজ করুন"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Detail / Schedule ---------- */}
      {modal?.kind === "detail" && (
        <Modal title="বিস্তারিত ও কিস্তির তালিকা" onClose={closeModal} wide>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3">
              <p><span className="text-gray-500">কর্মী:</span> <b>{modal.item.employeeName}</b> ({modal.item.employeeId})</p>
              <p><span className="text-gray-500">বিভাগ:</span> {modal.item.department || "-"}{modal.item.section ? ` / ${modal.item.section}` : ""}</p>
              <p><span className="text-gray-500">ধরন:</span> {TYPES[modal.item.type]} · {CATEGORIES[modal.item.category]}</p>
              <p><span className="text-gray-500">পরিমাণ:</span> <b>৳ {money(modal.item.amount)}</b></p>
              <p><span className="text-gray-500">টাকা দেওয়া:</span> {formatDate(modal.item.issueDate)}</p>
              <p><span className="text-gray-500">স্ট্যাটাস:</span>{" "}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[modal.item.status]}`}>{modal.item.status}</span></p>
              <p><span className="text-gray-500">এন্ট্রি:</span> {modal.item.requestedByName} ({modal.item.requestedByRole})</p>
              <p><span className="text-gray-500">সিদ্ধান্ত:</span> {modal.item.decidedByName ? `${modal.item.decidedByName} · ${formatDate(modal.item.decidedAt)}` : "-"}</p>
              {modal.item.reason && <p className="col-span-2"><span className="text-gray-500">কারণ:</span> {modal.item.reason}</p>}
              {modal.item.decisionNote && <p className="col-span-2"><span className="text-gray-500">নোট:</span> {modal.item.decisionNote}</p>}
            </div>

            {modal.item.schedule?.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 uppercase text-gray-600">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">মাস</th>
                    <th className="px-3 py-2 text-right">কিস্তি</th>
                    <th className="px-3 py-2">অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modal.item.schedule.map((s, i) => (
                    <tr key={s._id}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2">{monthLabel(s.month)}</td>
                      <td className="px-3 py-2 text-right font-medium">৳ {money(s.amount)}</td>
                      <td className="px-3 py-2">
                        {s.deducted ? (
                          <span className="text-green-700">কাটা হয়েছে · {monthLabel(s.payrollMonth)} পেরোল</span>
                        ) : modal.item.status === "APPROVED" ? (
                          <span className="text-amber-700">বাকি</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-gray-500">
                অনুমোদনের পর কিস্তির তালিকা তৈরি হবে। পরিকল্পনা: {modal.item.installments} × ৳ {money(modal.item.installmentAmount)}, শুরু {monthLabel(modal.item.startMonth)}।
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdvanceLoans;
