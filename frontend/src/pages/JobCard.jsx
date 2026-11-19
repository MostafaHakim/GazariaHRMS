import { useEffect, useRef, useState } from "react";
import { FileText, Search, Printer, Download } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import api from "../services/api";
import { useAppSelector } from "../hooks/useAppSelector";
import JobCardSheet from "../components/dailyAttendance/JobCardSheet";
import {
  formatDate,
  formatDuration,
  formatTime,
} from "../utils/jobCardFormat";

const downloadCSV = (filename, headers, rows) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// A4 portrait, প্রতিটি কর্মীর কার্ড নতুন পাতায়
const PRINT_PAGE_STYLE = `
  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    html, body { background: #fff !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .job-card-page { break-after: page; page-break-after: always; }
    .job-card-page:last-child { break-after: auto; page-break-after: auto; }
  }
`;

const csvHeaders = [
  "Employee ID",
  "Name",
  "Date",
  "Shift",
  "IN",
  "OUT",
  "Worked",
  "Late",
  "Early",
  "OT",
  "Status",
  "Remarks",
];

const dayToCsvRow = (emp, d) => [
  emp.employeeId,
  emp.name,
  formatDate(d.attendanceDate),
  d.shiftCode || d.shift?.code || "",
  formatTime(d.firstIn),
  formatTime(d.lastOut),
  formatDuration(d.netWorkedMinutes),
  formatDuration(d.lateMinutes),
  formatDuration(d.earlyLeaveMinutes),
  formatDuration(d.overtimeMinutes),
  d.status,
  d.remarks || "",
];

const JobCard = () => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;

  const { activeCompanyId } = useAppSelector((state) => state.company);

  const [mode, setMode] = useState("single"); // "single" | "section"
  const [employeeId, setEmployeeId] = useState("");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState([]);
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]); // [{ employee, days, summary }]
  const [meta, setMeta] = useState({ company: "", section: "", skipped: 0 });

  const printRef = useRef(null);

  // Section ড্রপডাউনের তালিকা (কোম্পানি বদলালে আবার লোড)
  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    api
      .get("/employees", { params: { limit: 1 } })
      .then((res) => {
        if (!cancelled) setSections(res.data.sections || []);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  // মোড/কোম্পানি বদলালে আগের রেজাল্ট মুছে ফেলা
  useEffect(() => {
    setCards([]);
    setError("");
  }, [mode, activeCompanyId]);

  const load = async (e) => {
    e?.preventDefault();
    setError("");
    setCards([]);

    if (mode === "single" && !employeeId.trim()) {
      setError("Employee ID দিন");
      return;
    }
    if (mode === "section" && !section) {
      setError("একটি Section বাছুন");
      return;
    }

    setLoading(true);
    try {
      if (mode === "single") {
        const res = await api.get("/daily-attendance/job-card", {
          params: { employeeId: employeeId.trim().toUpperCase(), month },
        });
        const d = res.data;
        if (!d.days?.length) {
          setError("এই মাসে কোনো অ্যাটেনডেন্স রেকর্ড নেই। আগে Calculate করুন।");
        } else {
          setCards([{ employee: d.employee, days: d.days, summary: d.summary }]);
          setMeta({ company: "", section: "", skipped: 0 });
        }
      } else {
        const res = await api.get("/daily-attendance/section-job-cards", {
          params: { section, month },
        });
        const d = res.data;
        setCards(d.cards || []);
        setMeta({
          company: d.company || "",
          section: d.section || "",
          skipped: d.skipped || 0,
        });
        if (!d.cards?.length) {
          setError(
            "এই Section-এ এই মাসে কোনো অ্যাটেনডেন্স রেকর্ড নেই। আগে Calculate করুন।",
          );
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const sectionLabel = section === "__NONE__" ? "No-Section" : section;
  const fileTitle =
    mode === "section"
      ? `JobCards-${sectionLabel}-${month}`
      : `JobCard-${cards[0]?.employee?.employeeId || "emp"}-${month}`;

  // Print dialog-এ "Save as PDF" বাছলেই পুরো Section একটি PDF এ নামবে
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: fileTitle,
    pageStyle: PRINT_PAGE_STYLE,
  });

  const handleExportCSV = () => {
    if (!cards.length) return;
    const rows = cards.flatMap((c) =>
      c.days.map((d) => dayToCsvRow(c.employee, d)),
    );
    downloadCSV(`${fileTitle}.csv`, csvHeaders, rows);
  };

  const tabClass = (active) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${
      active
        ? "bg-emerald-600 text-white"
        : "border bg-white text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <FileText className="text-emerald-600" size={26} />
            Employee Job Card
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            একজন কর্মী অথবা পুরো Section-এর মাসের IN/OUT ও স্ট্যাটাস রিপোর্ট
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={tabClass(mode === "single")}
          >
            একজন কর্মী
          </button>
          <button
            type="button"
            onClick={() => setMode("section")}
            className={tabClass(mode === "section")}
          >
            পুরো Section
          </button>
        </div>
      </div>

      <form
        onSubmit={load}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
      >
        {mode === "single" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Employee ID
            </label>
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP001"
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Section
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="min-w-[180px] rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">-- Section বাছুন --</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__NONE__">No Section</option>
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Search size={16} />
          {loading ? "Loading..." : "Load Job Card"}
        </button>

        {cards.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handlePrint()}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              <Printer size={16} />
              {mode === "section"
                ? `PDF / Print (${cards.length} জন)`
                : "PDF / Print"}
            </button>
          </>
        )}
      </form>

      {error && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {mode === "section" && cards.length > 0 && meta.skipped > 0 && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {meta.skipped} জন কর্মীর এই মাসে কোনো রেকর্ড নেই (Calculate করা হয়নি),
          তাই তাদের কার্ড বাদ গেছে।
        </div>
      )}

      {cards.length > 0 && (
        <div ref={printRef} className="space-y-4 print:space-y-0">
          {cards.map((c) => (
            <JobCardSheet
              key={c.employee._id || c.employee.employeeId}
              company={meta.company}
              month={month}
              section={meta.section}
              employee={c.employee}
              days={c.days}
              summary={c.summary}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JobCard;
