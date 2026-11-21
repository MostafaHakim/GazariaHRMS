import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet, RefreshCw, FileSpreadsheet, Lock, Unlock, CheckCircle2, Trash2, Search,
  AlertTriangle, Loader2, RotateCcw, Users, Banknote, Smartphone, PauseCircle, X,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import api from "../services/api";
import {
  fetchPayroll, generatePayroll, updatePayrollLine, finalizePayroll,
  markPayrollPaid, reopenPayroll, deletePayroll, clearPayrollNotice,
} from "../features/payroll/payrollSlice";

const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(new Date());

const money = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const num = (n) => (Number(n) ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");
const METHODS = ["Bkash", "Bank", "Cash", "Hold"];

const STATUS_STYLE = {
  DRAFT: "bg-amber-100 text-amber-800",
  FINALIZED: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
};

// সেলে লিখে বের হলে (blur/Enter) সেভ হয়
const EditCell = (props) => <EditCellInner key={String(props.value ?? "")} {...props} />;

// key=value ধরে রিমাউন্ট হয়, তাই সার্ভার থেকে নতুন মান এলে ইনপুট নিজে থেকে হালনাগাদ হয়
const EditCellInner = ({ value, onSave, disabled, manual, type = "number", width = "w-14", align = "text-center", title }) => {
  const [draft, setDraft] = useState(String(value ?? ""));
  const ref = useRef(null);

  if (disabled) {
    return <span className={manual ? "font-semibold text-amber-700" : ""}>{type === "number" ? num(value) : value}</span>;
  }

  const commit = () => {
    const next = draft.trim();
    if (next === String(value ?? "")) return;
    if (type === "number" && (next === "" || Number.isNaN(Number(next)) || Number(next) < 0)) {
      setDraft(String(value ?? ""));
      return;
    }
    onSave(type === "number" ? Number(next) : next);
  };

  return (
    <input
      ref={ref}
      value={draft}
      title={title || (manual ? "Manually edited — Regenerate will keep this value" : undefined)}
      inputMode={type === "number" ? "decimal" : "text"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") ref.current?.blur();
        if (e.key === "Escape") { setDraft(String(value ?? "")); ref.current?.blur(); }
      }}
      className={`${width} ${align} rounded border px-1 py-0.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${
        manual ? "border-amber-300 bg-amber-50 font-semibold text-amber-800" : "border-slate-200 bg-white"
      }`}
    />
  );
};

const Payroll = () => {
  const dispatch = useAppDispatch();
  const { run, lines, summary, loading, working, error, message } = useAppSelector((s) => s.payroll);
  const user = useAppSelector((s) => s.auth.user);
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);

  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState("sheet");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groupReport, setGroupReport] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const canWrite = user?.role === "ADMIN" || user?.role === "HR";
  const editable = canWrite && run?.status === "DRAFT";

  useEffect(() => {
    dispatch(fetchPayroll({ month }));
  }, [dispatch, month, activeCompanyId]);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => dispatch(clearPayrollNotice()), 4000);
    return () => clearTimeout(t);
  }, [message, dispatch]);

  const needsReview = (l) => l.incompleteDays > 0 || l.missingDays > 0 || !(l.basicSalary > 0);

  const departments = useMemo(() => summary?.departments?.map((d) => d.department) || [], [summary]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (department && l.department !== department) return false;
      if (reviewOnly && !needsReview(l)) return false;
      if (q && !(String(l.employeeId).toLowerCase().includes(q) || l.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [lines, department, search, reviewOnly]);

  const totals = useMemo(() => {
    const keys = ["basicSalary", "salaryPayable", "otDayHours", "otNightHours", "otHours", "otAmount", "ot20", "attBonus", "nightAllowance", "prevAdjAddition", "prevAdjDeduction", "advance", "loanDeduction", "netPayable"];
    return Object.fromEntries(keys.map((k) => [k, visible.reduce((s, l) => s + (Number(l[k]) || 0), 0)]));
  }, [visible]);

  const save = (line, patch) => dispatch(updatePayrollLine({ id: line._id, data: patch, month }));
  const manual = (l, f) => l.manualFields?.includes(f);

  const handleGenerate = () => {
    if (lines.length > 0 && !window.confirm("Regenerate? Attendance-based values will be refreshed. Manually edited cells, adjustments and advances are kept; approved Advance/Loan installments are re-applied.")) return;
    dispatch(generatePayroll({ month }));
  };

  const handleGroupReport = async () => {
    try {
      setGroupLoading(true);
      const { data } = await api.get("/payroll/group-summary", { params: { month } });
      setGroupReport(data);
    } catch (err) {
      window.alert(err.response?.data?.message || "Group report could not be loaded");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get("/payroll/export", {
        params: { month, ...(department ? { departments: department } : {}) },
        responseType: "blob",
      });
      const cd = res.headers["content-disposition"] || "";
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || `Payroll_${month}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const confirmThen = (text, action) => () => window.confirm(text) && dispatch(action({ month }));

  const th = "border border-slate-600 bg-[#1F4E78] px-2 py-2 text-center text-[11px] font-semibold text-white";
  const td = "border border-slate-200 px-2 py-1.5 text-center text-xs";

  const cards = summary
    ? [
        { label: "Employees", value: summary.totals.headcount, icon: Users, tone: "bg-blue-50 text-blue-600" },
        { label: "Net Payable", value: `৳ ${money(summary.totals.netPayable)}`, icon: Wallet, tone: "bg-emerald-50 text-emerald-600" },
        { label: `bKash (${summary.methods.Bkash.count})`, value: `৳ ${money(summary.methods.Bkash.amount)}`, icon: Smartphone, tone: "bg-pink-50 text-pink-600" },
        { label: `Cash / Bank (${summary.methods.Cash.count + summary.methods.Bank.count})`, value: `৳ ${money(summary.methods.Cash.amount + summary.methods.Bank.amount)}`, icon: Banknote, tone: "bg-violet-50 text-violet-600" },
        { label: `On Hold (${summary.methods.Hold.count})`, value: `৳ ${money(summary.holdAmount)}`, icon: PauseCircle, tone: "bg-amber-50 text-amber-600" },
      ]
    : [];

  const w = summary?.warnings;

  return (
    <div className="space-y-5">
      {groupReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-800">Group Payroll Summary — {groupReport.month}</h2><p className="text-xs text-slate-500">Read-only consolidated view for all active companies</p></div>
              <button onClick={() => setGroupReport(null)} className="rounded-lg border px-3 py-1.5 text-sm">Close</button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[ ["Employees", groupReport.totals.headcount], ["Basic Salary", money(groupReport.totals.basicSalary)], ["OT Amount", money(groupReport.totals.otAmount)], ["Net Payable", money(groupReport.totals.netPayable)] ].map(([label, value]) => <div key={label} className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-800">{value}</p></div>)}
            </div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Company</th><th className="p-2">Code</th><th className="p-2">Status</th><th className="p-2 text-right">Employees</th><th className="p-2 text-right">Net Payable</th></tr></thead><tbody>{groupReport.companies.map((row) => <tr key={row.company._id} className="border-b"><td className="p-2 font-medium">{row.company.name}</td><td className="p-2">{row.company.code}</td><td className="p-2">{row.run?.status || "Not Generated"}</td><td className="p-2 text-right">{row.summary?.totals.headcount || 0}</td><td className="p-2 text-right">৳ {money(row.summary?.totals.netPayable || 0)}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><Wallet size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Payroll</h1>
            <p className="text-xs text-slate-500">Monthly payroll sheet — generated from attendance</p>
          </div>
          {run && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[run.status]}`}>{run.status}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button onClick={handleGroupReport} disabled={groupLoading}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60">
              {groupLoading ? "Loading group..." : "Group Payroll Summary"}
            </button>
          )}
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          />
          {canWrite && (!run || run.status === "DRAFT") && (
            <button onClick={handleGenerate} disabled={working}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {working ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {run ? "Regenerate" : "Generate Payroll"}
            </button>
          )}
          {run && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} className="text-emerald-600" />}
              {department ? `Export Excel (${department})` : "Export Excel"}
            </button>
          )}
          {isAdmin && run?.status === "DRAFT" && (
            <>
              <button onClick={confirmThen("Finalize this payroll? Editing will be locked.", finalizePayroll)} disabled={working}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Lock size={16} /> Finalize
              </button>
              <button onClick={confirmThen(`Delete the draft payroll for ${month}?`, deletePayroll)}
                className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50" title="Delete draft">
                <Trash2 size={17} />
              </button>
            </>
          )}
          {isAdmin && run?.status === "FINALIZED" && (
            <>
              <button onClick={confirmThen("Mark this payroll as PAID?", markPayrollPaid)} disabled={working}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                <CheckCircle2 size={16} /> Mark Paid
              </button>
              <button onClick={confirmThen("Reopen as DRAFT for editing?", reopenPayroll)} disabled={working}
                className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Unlock size={16} /> Reopen
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => dispatch(clearPayrollNotice())}><X size={16} /></button>
        </div>
      )}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{message}</div>}

      {loading && !run && (
        <div className="flex items-center justify-center rounded-xl border bg-white py-16 text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={20} /> Loading payroll...
        </div>
      )}

      {!loading && !run && (
        <div className="rounded-xl border border-dashed bg-white py-16 text-center">
          <Wallet size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">No payroll for {month} yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canWrite ? "Click “Generate Payroll” — Daily Attendance should be calculated for the whole month first." : "Ask HR/Admin to generate it."}
          </p>
        </div>
      )}

      {run && summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="flex items-center gap-3 rounded-xl border bg-white p-4">
                <div className={`rounded-lg p-2.5 ${c.tone}`}><c.icon size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className="text-base font-bold text-slate-800">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {(w.incomplete > 0 || w.missing > 0 || w.noSalary > 0 || w.noAccount > 0 || w.negativeNet > 0) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <AlertTriangle size={16} className="shrink-0" />
              {w.incomplete > 0 && <span><b>{w.incomplete}</b> employee(s) with single-punch (INCOMPLETE) days — counted as absent until fixed</span>}
              {w.missing > 0 && <span><b>{w.missing}</b> with days missing in attendance</span>}
              {w.noSalary > 0 && <span><b>{w.noSalary}</b> with no salary set</span>}
              {w.noAccount > 0 && <span><b>{w.noAccount}</b> bKash/Bank without account number</span>}
              {w.negativeNet > 0 && <span><b>{w.negativeNet}</b> with negative Net Payable (deductions exceed earnings)</span>}
              <button onClick={() => { setReviewOnly((v) => !v); setTab("sheet"); }} className="ml-auto text-xs font-semibold underline">
                {reviewOnly ? "Show all" : "Show only these"}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {[["sheet", "Payroll Sheet"], ["dept", "Department Summary"], ["pay", "Payment List"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ---------- Payroll Sheet ---------- */}
          {tab === "sheet" && (
            <div className="rounded-xl border bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b p-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID or name"
                    className="w-56 rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
                </div>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} /> Needs review
                </label>
                <p className="ml-auto text-xs text-slate-500">
                  {visible.length} of {lines.length} employees
                  {editable && " · edit cells directly; amber = manually edited"}
                </p>
              </div>

              <div className="max-h-[68vh] overflow-auto">
                <table className="min-w-max border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      {["SL", "Department", "ID", "Name", "Designation", "Month Days", "Present", "Absent", "Leave", "Late", "WH Days", "Night", "Payable Days",
                        "Basic Salary", "Salary Payable", "OT (Day) Hours", "OT (Night) Hours", "OT Hours", "OT Amount", "OT 20%", "Att. Bonus", "Night Allowance",
                        "Prev. Adj. Addition", "Prev. Adj. Deduction", "Advance", "Adv/Loan Inst.", "Net Payable", "Method", "BKASH/BANK Account", "Remarks", ""].map((h, i) => (
                        <th key={i} className={`${th} ${i === 3 ? "sticky left-0 z-30" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l) => {
                      const warn = needsReview(l);
                      return (
                        <tr key={l._id} className={l.method === "Hold" ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                          <td className={td}>{l.sl}</td>
                          <td className={`${td} whitespace-nowrap text-left`}>{l.department}</td>
                          <td className={td}>{l.employeeId}</td>
                          <td className={`${td} sticky left-0 z-10 whitespace-nowrap bg-white text-left font-medium`}>
                            {l.name}
                            {warn && <AlertTriangle size={12} className="ml-1 inline text-amber-500"
                              title={[l.incompleteDays > 0 && `${l.incompleteDays} incomplete day(s)`, l.missingDays > 0 && `${l.missingDays} day(s) missing`, !(l.basicSalary > 0) && "no salary"].filter(Boolean).join(", ")} />}
                          </td>
                          <td className={`${td} whitespace-nowrap text-left`}>{l.designation}</td>
                          <td className={td}>{l.monthDays}</td>
                          <td className={td}>{l.present}</td>
                          {["absent", "leave", "late", "whDays", "night"].map((f) => (
                            <td key={f} className={td}>
                              <EditCell value={l[f]} manual={manual(l, f)} disabled={!editable} width="w-11" onSave={(v) => save(l, { [f]: v })} />
                            </td>
                          ))}
                          <td className={td}>{l.payableDays}</td>
                          <td className={`${td} font-semibold`}>
                            <EditCell value={l.basicSalary} manual={manual(l, "basicSalary")} disabled={!editable} width="w-16" onSave={(v) => save(l, { basicSalary: v })} />
                          </td>
                          <td className={td}>{money(l.salaryPayable)}</td>
                          {["otDayHours", "otNightHours"].map((f) => (
                            <td key={f} className={td}>
                              <EditCell value={l[f]} manual={manual(l, f)} disabled={!editable} width="w-12" onSave={(v) => save(l, { [f]: v })} />
                            </td>
                          ))}
                          <td className={td}>{num(l.otHours)}</td>
                          <td className={td}>{money(l.otAmount)}</td>
                          <td className={td}>{money(l.ot20)}</td>
                          <td className={td}>{money(l.attBonus)}</td>
                          <td className={td}>{money(l.nightAllowance)}</td>
                          {["prevAdjAddition", "prevAdjDeduction", "advance"].map((f) => (
                            <td key={f} className={td}>
                              <EditCell value={l[f]} disabled={!editable} width="w-16" onSave={(v) => save(l, { [f]: v })} />
                            </td>
                          ))}
                          <td className={`${td} ${l.loanDeduction > 0 ? "bg-violet-50 font-semibold text-violet-700" : "text-slate-400"}`}
                            title={l.loanDeduction > 0 ? (l.loanRefs || []).map((r) => `${r.label}: ${r.amount}`).join("\n") : "No approved Advance/Loan installment"}>
                            {l.loanDeduction > 0 ? money(l.loanDeduction) : "-"}
                          </td>
                          <td className={`${td} bg-emerald-50 text-sm font-bold ${l.netPayable < 0 ? "text-red-600" : "text-emerald-800"}`}>{money(l.netPayable)}</td>
                          <td className={td}>
                            {editable ? (
                              <select value={l.method} onChange={(e) => save(l, { method: e.target.value })}
                                className={`rounded border px-1 py-0.5 text-xs ${manual(l, "method") ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                                {METHODS.map((m) => <option key={m}>{m}</option>)}
                              </select>
                            ) : l.method}
                          </td>
                          <td className={td}>
                            <EditCell type="text" value={l.accountNumber} manual={manual(l, "accountNumber")} disabled={!editable} width="w-28" onSave={(v) => save(l, { accountNumber: v })} />
                          </td>
                          <td className={td}>
                            <EditCell type="text" value={l.remarks} disabled={!editable} width="w-40" align="text-left" onSave={(v) => save(l, { remarks: v })} />
                          </td>
                          <td className={td}>
                            {editable && l.manualFields?.length > 0 && (
                              <button title="Reset manual values to attendance" onClick={() => save(l, { reset: l.manualFields })}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><RotateCcw size={14} /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {visible.length === 0 && (
                      <tr><td colSpan={31} className="py-10 text-center text-sm text-slate-500">No employees match the filter</td></tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20">
                    <tr className="bg-[#D9E1F2] text-xs font-bold">
                      <td className={td} colSpan={13} style={{ textAlign: "right" }}>TOTAL ({visible.length})</td>
                      <td className={td}>{money(totals.basicSalary)}</td>
                      <td className={td}>{money(totals.salaryPayable)}</td>
                      <td className={td}>{num(totals.otDayHours)}</td>
                      <td className={td}>{num(totals.otNightHours)}</td>
                      <td className={td}>{num(totals.otHours)}</td>
                      <td className={td}>{money(totals.otAmount)}</td>
                      <td className={td}>{money(totals.ot20)}</td>
                      <td className={td}>{money(totals.attBonus)}</td>
                      <td className={td}>{money(totals.nightAllowance)}</td>
                      <td className={td}>{money(totals.prevAdjAddition)}</td>
                      <td className={td}>{money(totals.prevAdjDeduction)}</td>
                      <td className={td}>{money(totals.advance)}</td>
                      <td className={td}>{money(totals.loanDeduction)}</td>
                      <td className={`${td} text-sm`}>{money(totals.netPayable)}</td>
                      <td className={td} colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ---------- Department Summary (TOP_SHEET) ---------- */}
          {tab === "dept" && (
            <div className="overflow-auto rounded-xl border bg-white">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    {["SL", "Department", "Headcount", "Basic Salary", "Salary Payable", "OT (Day) Hrs", "OT (Night) Hrs", "OT Hrs", "OT Amount", "OT 20%", "Att. Bonus", "Night Allowance", "Prev. Adj. Add", "Prev. Adj. Ded", "Advance", "Adv/Loan Inst.", "Net Payable"].map((h) => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.departments.map((d, i) => (
                    <tr key={d.department} className="hover:bg-slate-50">
                      <td className={td}>{i + 1}</td>
                      <td className={`${td} text-left font-medium`}>{d.department}</td>
                      <td className={td}>{d.headcount}</td>
                      {["basicSalary", "salaryPayable", "otDayHours", "otNightHours", "otHours", "otAmount", "ot20", "attBonus", "nightAllowance", "prevAdjAddition", "prevAdjDeduction", "advance", "loanDeduction"].map((k) => (
                        <td key={k} className={`${td} text-right`}>{["otDayHours", "otNightHours", "otHours"].includes(k) ? num(d[k]) : money(d[k])}</td>
                      ))}
                      <td className={`${td} bg-emerald-50 text-right font-bold text-emerald-800`}>{money(d.netPayable)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#D9E1F2] font-bold">
                    <td className={td} />
                    <td className={`${td} text-left`}>GRAND TOTAL</td>
                    <td className={td}>{summary.totals.headcount}</td>
                    {["basicSalary", "salaryPayable", "otDayHours", "otNightHours", "otHours", "otAmount", "ot20", "attBonus", "nightAllowance", "prevAdjAddition", "prevAdjDeduction", "advance", "loanDeduction", "netPayable"].map((k) => (
                      <td key={k} className={`${td} text-right`}>{["otDayHours", "otNightHours", "otHours"].includes(k) ? num(summary.totals[k]) : money(summary.totals[k])}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ---------- Payment List (BKASH / Bank / Cash / Hold) ---------- */}
          {tab === "pay" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {METHODS.map((m) => {
                const list = lines.filter((l) => l.method === m);
                const sum = list.reduce((s, l) => s + l.netPayable, 0);
                return (
                  <div key={m} className="rounded-xl border bg-white">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <h3 className="font-semibold text-slate-800">{m === "Bkash" ? "bKash" : m} <span className="text-xs font-normal text-slate-500">({list.length})</span></h3>
                      <span className="text-sm font-bold text-emerald-700">৳ {money(sum)}</span>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      <table className="min-w-full text-xs">
                        <tbody>
                          {list.map((l) => (
                            <tr key={l._id} className="border-b last:border-0">
                              <td className="px-3 py-1.5 text-slate-500">{l.employeeId}</td>
                              <td className="px-3 py-1.5 font-medium">{l.name}</td>
                              <td className={`px-3 py-1.5 ${["Bkash", "Bank"].includes(m) && !l.accountNumber ? "font-semibold text-red-600" : "text-slate-500"}`}>
                                {l.accountNumber || (["Bkash", "Bank"].includes(m) ? "No account" : "")}
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold">{money(l.netPayable)}</td>
                            </tr>
                          ))}
                          {list.length === 0 && <tr><td className="px-3 py-6 text-center text-slate-400">None</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {run.status !== "DRAFT" && (
            <p className="text-xs text-slate-500">
              This payroll is {run.status}. {isAdmin && run.status === "FINALIZED" ? "Reopen it to make changes." : "Editing is locked."}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Payroll;
