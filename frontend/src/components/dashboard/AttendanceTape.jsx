import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarDays, RefreshCw } from "lucide-react";

// প্রতিটি অংশ একে অপরের থেকে আলাদা (একজন কর্মী একটিতেই পড়ে)
const SEGMENTS = [
  { key: "present", label: "সময়মতো", color: "bg-emerald-400" },
  { key: "late", label: "লেট", color: "bg-amber-400" },
  { key: "night", label: "নাইট চলমান", color: "bg-indigo-400" },
  { key: "incomplete", label: "এক পাঞ্চ", color: "bg-violet-400" },
  { key: "leave", label: "ছুটিতে", color: "bg-sky-400" },
  { key: "absent", label: "অনুপস্থিত", color: "bg-rose-400" },
];

const OTHER = { key: "other", label: "সাপ্তাহিক/সরকারি ছুটি", color: "bg-slate-500" };

// ইলাস্টিক ফিতার বুননের মতো হালকা তির্যক রেখা
const WEAVE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,.2) 0 2px, transparent 2px 7px)",
};

const AttendanceTape = ({
  summary,
  loading,
  failed,
  refreshing,
  updatedAt,
  onRefresh,
}) => {
  const [ready, setReady] = useState(false);

  // ফিতাটি একবারই বাঁ দিক থেকে টান খেয়ে ভরে ওঠে
  useEffect(() => {
    if (loading || !summary) return undefined;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [loading, summary]);

  const hasData = Boolean(summary) && (summary.total || 0) > 0;

  const counts = {};
  let known = 0;
  if (hasData) {
    for (const s of SEGMENTS) {
      counts[s.key] = Number(summary[s.key]) || 0;
      known += counts[s.key];
    }
  }
  const total = hasData ? Number(summary.total) : 0;
  counts.other = Math.max(0, total - known);

  const denominator = Math.max(total, known) || 1;
  const attended = (counts.present || 0) + (counts.late || 0);
  const workingTotal = total - counts.other;
  const rate = workingTotal > 0 ? Math.round((attended / workingTotal) * 100) : 0;
  const incompleteLate = Number(summary?.incompleteLate) || 0;

  const visible = hasData
    ? [...SEGMENTS, OTHER].filter((s) => counts[s.key] > 0)
    : [];

  const updatedText = updatedAt
    ? updatedAt.toLocaleTimeString("bn-BD", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Dhaka",
      })
    : null;

  return (
    <section
      aria-labelledby="attendance-hero-title"
      className="rounded-xl bg-slate-900 p-5 text-white shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="attendance-hero-title" className="text-base font-medium text-slate-300">
          আজকের উপস্থিতি
        </h2>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {updatedText && <span>আপডেট {updatedText}</span>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="উপস্থিতির তথ্য রিফ্রেশ করুন"
            className="rounded-md border border-slate-700 p-1.5 text-slate-300 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <Link
            to="/daily-attendance"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            বিস্তারিত দেখুন
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 animate-pulse" aria-busy="true">
          <div className="h-12 w-40 rounded bg-slate-800" />
          <div className="mt-6 h-12 rounded bg-slate-800" />
        </div>
      ) : failed ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <AlertCircle size={18} className="shrink-0" />
          <span>উপস্থিতির তথ্য আনা যায়নি। সার্ভার চালু আছে কি না দেখে আবার চেষ্টা করুন।</span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md bg-rose-100 px-3 py-1 font-medium text-rose-900 hover:bg-white"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : !hasData ? (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-slate-600 p-5">
          <CalendarDays size={28} className="shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">আজকের Attendance হিসাব হয়নি</p>
            <p className="mt-1 text-sm text-slate-400">
              Weekly Roster তৈরি করে Attendance পেজ থেকে Sync ও Calculate চালান।
            </p>
          </div>
          <Link
            to="/attendance"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Attendance এ যান
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl font-semibold tabular-nums leading-none">
              {attended}
            </span>
            <span className="text-lg text-slate-300">
              জন উপস্থিত, মোট {workingTotal} জনের মধ্যে
            </span>
            <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-sm font-medium text-emerald-300">
              হার {rate}%
            </span>
          </p>

          {/* ইলাস্টিক ফিতা: প্রতিটি অংশ এক ধরনের স্ট্যাটাস */}
          <div className="mt-6">
            <div className="border-t border-dashed border-slate-600" />
            <div
              role="img"
              aria-label={visible.map((s) => `${s.label} ${counts[s.key]}`).join(", ")}
              className="relative my-2 flex h-12 overflow-hidden rounded-sm bg-slate-800"
            >
              {visible.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${counts[s.key]}`}
                  className={`${s.color} h-full border-r border-slate-900/40 transition-[width] duration-1000 ease-out last:border-r-0 motion-reduce:transition-none`}
                  style={{ width: ready ? `${(counts[s.key] / denominator) * 100}%` : "0%" }}
                />
              ))}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={WEAVE} />
            </div>
            <div className="border-b border-dashed border-slate-600" />
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 xl:grid-cols-7">
            {visible.map((s) => (
              <li key={s.key} className="flex items-start gap-2">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-sm ${s.color}`} />
                <div>
                  <p className="text-xl font-semibold leading-tight tabular-nums">
                    {counts[s.key]}
                  </p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              </li>
            ))}
          </ul>

          {incompleteLate > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              এক পাঞ্চওয়ালাদের মধ্যে {incompleteLate} জন ১০ মিনিটের বেশি দেরিতে এসেছেন।
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default AttendanceTape;
