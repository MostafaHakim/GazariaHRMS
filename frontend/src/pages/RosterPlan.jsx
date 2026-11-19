import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { fetchDepartments } from "../features/departments/departmentSlice";

const toInput = (d) => d.toISOString().slice(0, 10);
const bdToday = () => new Date(Date.now() + 6 * 60 * 60 * 1000);

// শনিবার = সপ্তাহের প্রথম দিন
const getSaturday = (d) => {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCDate(r.getUTCDate() - ((r.getUTCDay() + 1) % 7));
  return r;
};

const yearRange = (year) => ({
  from: toInput(getSaturday(new Date(Date.UTC(year, 0, 1)))),
  to: toInput(getSaturday(new Date(Date.UTC(year, 11, 31)))),
});

const PALETTE = [
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-sky-100 text-sky-800 border-sky-300",
  "bg-lime-100 text-lime-800 border-lime-300",
];

const shortCode = (s) => String(s.code || s.name || "?").split("-")[0].slice(0, 3);

const RosterPlan = () => {
  const dispatch = useAppDispatch();
  const departments = useAppSelector((s) => s.departments.departments) || [];
  const activeCompanyId = useAppSelector((s) => s.company.activeCompanyId);

  const thisYear = bdToday().getUTCFullYear();
  const [range, setRange] = useState(() => yearRange(thisYear));
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [type, setType] = useState("ROTATE");
  const [pickA, setShiftA] = useState("");
  const [pickB, setShiftB] = useState("");
  const [shiftC, setShiftC] = useState("");
  const [interval, setIntervalWeeks] = useState(1);
  const [pickFrom, setEffectiveFrom] = useState("");
  const [alsoGenerate, setAlsoGenerate] = useState(true);

  const [editCell, setEditCell] = useState(null); // { row, weekIdx }
  const [editShift, setEditShift] = useState("");
  const [editScope, setEditScope] = useState("WEEK");

  useEffect(() => {
    dispatch(fetchDepartments());
  }, [dispatch, activeCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/roster-plans/preview", {
        params: {
          from: range.from,
          to: range.to,
          department: department || undefined,
          section: section || undefined,
          search: search.trim() || undefined,
        },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "ডাটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, [range, department, section, search, activeCompanyId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const shifts = useMemo(() => data?.shifts || [], [data]);
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s._id, s])), [shifts]);

  // শিফট-রং: Night = indigo, Day-জাতীয় = amber, বাকিগুলো palette
  const colorOf = useMemo(() => {
    const map = new Map();
    let i = 0;
    shifts.forEach((s) => {
      if (s.isNightShift) map.set(s._id, "bg-indigo-100 text-indigo-800 border-indigo-300");
      else if (/^DAY/i.test(s.code)) map.set(s._id, "bg-amber-100 text-amber-800 border-amber-300");
      else map.set(s._id, PALETTE[i++ % PALETTE.length]);
    });
    return map;
  }, [shifts]);

  // ডিফল্ট: প্রথম Day-জাতীয় ও প্রথম Night শিফট; তারিখ ডিফল্ট = রেঞ্জের শুরু
  const shiftA = pickA || (shifts.find((x) => !x.isNightShift) || shifts[0])?._id || "";
  const shiftB = pickB || (shifts.find((x) => x.isNightShift) || shifts[1] || shifts[0])?._id || "";
  const effectiveFrom = pickFrom || range.from;

  const currentWeek = toInput(getSaturday(bdToday()));
  const weeks = data?.weeks || [];
  const rows = data?.rows || [];
  const generatedWeeks = (data?.weekStatus || []).filter(Boolean).length;
  const publishedWeeks = (data?.weekStatus || []).filter((s) => s === "PUBLISHED").length;

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.employee._id));
  const toggleAll = () =>
    setSelected(allSelected ? [] : rows.map((r) => r.employee._id));
  const toggleOne = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const run = async (fn, okText) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fn();
      const s = res.data.summary || res.data.generated;
      let extra = "";
      if (s) {
        extra = ` (নতুন ${s.created}, আপডেট ${s.updated}, Manual অক্ষত ${s.manualPreserved}`;
        if (s.unassigned) extra += `, প্যাটার্ন নেই ${s.unassigned} জন`;
        extra += ")";
      }
      setMessage((res.data.message || okText) + extra);
      await load();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "কাজটি সম্পন্ন হয়নি");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePattern = async () => {
    if (!selected.length) return setError("আগে কর্মী নির্বাচন করুন");
    const shiftIds =
      type === "FIXED" ? [shiftA] : [shiftA, shiftB, shiftC].filter(Boolean);
    if (type === "ROTATE" && new Set(shiftIds).size < 2)
      return setError("Rotate-এর জন্য কমপক্ষে ২টি আলাদা শিফট নির্বাচন করুন");
    const names = shiftIds.map((id) => shiftMap.get(id)?.name).join(" → ");
    const ok = window.confirm(
      `${selected.length} জন কর্মী ${effectiveFrom} সপ্তাহ থেকে: ${
        type === "FIXED" ? `সবসময় ${names}` : `${names} (প্রতি ${interval} সপ্তাহ পর পর বদল)`
      }। নিশ্চিত?`,
    );
    if (!ok) return;
    const done = await run(
      () =>
        api.post("/roster-plans/assign", {
          employeeIds: selected,
          type,
          shiftIds,
          intervalWeeks: Number(interval),
          effectiveFrom,
          generateTo: alsoGenerate ? range.to : undefined,
        }),
      "প্যাটার্ন সেভ হয়েছে",
    );
    if (done) setSelected([]);
  };

  const generateAll = () => {
    if (!window.confirm(`${range.from} থেকে ${range.to} পর্যন্ত (${weeks.length} সপ্তাহ) সব কর্মীর Roster Generate করবেন? Manual বদল অক্ষত থাকবে।`)) return;
    run(() => api.post("/roster-plans/generate", { from: range.from, to: range.to }), "Generate হয়েছে");
  };

  const publishAll = () => {
    if (!window.confirm(`${weeks.length} সপ্তাহের Roster Publish করবেন?`)) return;
    run(() => api.post("/roster-plans/publish", { from: range.from, to: range.to }), "Published");
  };

  const openCell = (row, weekIdx) => {
    setEditCell({ row, weekIdx });
    setEditShift(row.cells[weekIdx].s || shifts[0]?._id || "");
    setEditScope("WEEK");
  };

  const saveOverride = async () => {
    const { row, weekIdx } = editCell;
    const ok = await run(
      () =>
        api.put("/roster-plans/override", {
          employeeId: row.employee._id,
          weekStartDate: weeks[weekIdx],
          shiftId: editShift,
          scope: editScope,
        }),
      "শিফট বদলানো হয়েছে",
    );
    if (ok) setEditCell(null);
  };

  const patternLabel = (p) => {
    if (!p) return null;
    const names = p.shifts.map((id) => (shiftMap.get(id) ? shortCode(shiftMap.get(id)) : "?"));
    return p.type === "FIXED"
      ? `সবসময় ${names[0]}`
      : `${names.join(" ⇄ ")} · ${p.intervalWeeks} সপ্তাহ`;
  };

  const fmtWeek = (iso) => {
    const d = new Date(`${iso}T00:00:00.000Z`);
    return {
      day: String(d.getUTCDate()).padStart(2, "0"),
      mon: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
    };
  };

  const input = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <CalendarRange className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-800">Roster Plan</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          ১) কর্মী টিক দিন → ২) প্যাটার্ন দিন (সবসময় একটা শিফট, অথবা দুই/তিন শিফটে সাপ্তাহিক বদল) →
          ৩) পুরো বছরের Roster Generate → ৪) Publish। সবার সাপ্তাহিক ছুটি শুক্রবার; শুক্রবার কাজ করলে
          হাজিরায় সেটি OT ধরা হবে।
        </p>
      </div>

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5" /> {message}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {error}
        </div>
      )}

      {/* Range + generate */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-600">
          শুরু
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: toInput(getSaturday(new Date(`${e.target.value}T00:00:00Z`))) }))} className={`${input} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          শেষ
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: toInput(getSaturday(new Date(`${e.target.value}T00:00:00Z`))) }))} className={`${input} mt-1 block`} />
        </label>
        {[thisYear, thisYear + 1].map((y) => (
          <button key={y} type="button" onClick={() => { setRange(yearRange(y)); setEffectiveFrom(yearRange(y).from); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
            {y} পুরো বছর
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500">
            {weeks.length} সপ্তাহ · Generated {generatedWeeks} · Published {publishedWeeks}
          </span>
          <button type="button" disabled={busy} onClick={generateAll} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            পুরো রেঞ্জ Generate
          </button>
          <button type="button" disabled={busy || !generatedWeeks} onClick={publishAll} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Publish
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setSection(""); setSelected([]); }} className={input}>
          <option value="">সব Department</option>
          {departments.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
        </select>
        <select value={section} onChange={(e) => { setSection(e.target.value); setSelected([]); }} className={input}>
          <option value="">সব Section</option>
          <option value="__NONE__">Section নেই</option>
          {(data?.sections || []).map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID বা নাম" className={`${input} w-full pl-9`} />
        </div>
      </div>

      {data?.unassigned > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={16} /> {data.unassigned} জনের প্যাটার্ন সেট নেই — এদের Roster তৈরি হবে না। টিক দিয়ে প্যাটার্ন দিন।
        </div>
      )}

      {/* Pattern panel */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-gray-800">নির্বাচিত: {selected.length} জন</span>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={type === "FIXED"} onChange={() => setType("FIXED")} /> সবসময় একই শিফট
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={type === "ROTATE"} onChange={() => setType("ROTATE")} /> সাপ্তাহিক বদল (Rotate)
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-gray-600">
            {type === "FIXED" ? "শিফট" : "শুরুর শিফট"}
            <select value={shiftA} onChange={(e) => setShiftA(e.target.value)} className={`${input} mt-1 block`}>
              {shifts.map((s) => (<option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>))}
            </select>
          </label>
          {type === "ROTATE" && (
            <>
              <button type="button" title="শিফট দুটি অদলবদল" onClick={() => { setShiftA(shiftB); setShiftB(shiftA); }} className="mb-0.5 rounded-lg border border-gray-300 p-2.5 hover:bg-gray-50">
                <ArrowLeftRight size={15} />
              </button>
              <label className="text-xs font-medium text-gray-600">
                পরের শিফট
                <select value={shiftB} onChange={(e) => setShiftB(e.target.value)} className={`${input} mt-1 block`}>
                  {shifts.map((s) => (<option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                ৩য় শিফট (ঐচ্ছিক)
                <select value={shiftC} onChange={(e) => setShiftC(e.target.value)} className={`${input} mt-1 block`}>
                  <option value="">—</option>
                  {shifts.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                কত সপ্তাহ পর বদল
                <input type="number" min="1" max="52" value={interval} onChange={(e) => setIntervalWeeks(e.target.value)} className={`${input} mt-1 block w-24`} />
              </label>
            </>
          )}
          <label className="text-xs font-medium text-gray-600">
            কার্যকর (সপ্তাহ শুরু)
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={`${input} mt-1 block`} />
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={alsoGenerate} onChange={(e) => setAlsoGenerate(e.target.checked)} /> সাথে সাথে Roster Generate
          </label>
          <button type="button" disabled={busy || !selected.length} onClick={savePattern} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            প্যাটার্ন সেভ
          </button>
        </div>
        <p className="text-xs text-gray-500">
          উদাহরণ: ১০ জন টিক → "সাপ্তাহিক বদল: Day → Night" ৪ জনকে, "Night → Day" ৩ জনকে, "সবসময় Day" ২ জনকে, "সবসময় Night" ১ জনকে — চারবারে।
        </p>
      </div>

      {/* Matrix */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="sticky left-0 z-30 w-10 bg-gray-50 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="sticky left-10 z-30 min-w-[180px] bg-gray-50 px-3 py-2">কর্মী</th>
              <th className="min-w-[120px] bg-gray-50 px-3 py-2">Section</th>
              <th className="min-w-[150px] bg-gray-50 px-3 py-2">প্যাটার্ন</th>
              {weeks.map((w) => {
                const f = fmtWeek(w);
                return (
                  <th key={w} className={`w-12 min-w-[48px] px-1 py-1 text-center text-[10px] leading-tight ${w === currentWeek ? "bg-emerald-100 text-emerald-700" : "bg-gray-50"}`}>
                    {f.day}<br />{f.mon}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={4 + weeks.length} className="px-4 py-8 text-center text-gray-400">লোড হচ্ছে...</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td colSpan={4 + weeks.length} className="px-4 py-8 text-center text-gray-400">কোনো কর্মী পাওয়া যায়নি</td></tr>)}
            {!loading && rows.map((row) => (
              <tr key={row.employee._id} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-3 py-1.5"><input type="checkbox" checked={selected.includes(row.employee._id)} onChange={() => toggleOne(row.employee._id)} /></td>
                <td className="sticky left-10 z-10 border-t border-gray-100 bg-white px-3 py-1.5">
                  <div className="font-semibold text-gray-800">{row.employee.name}</div>
                  <div className="text-xs text-gray-500">{row.employee.employeeId}</div>
                </td>
                <td className="border-t border-gray-100 px-3 py-1.5 text-gray-600">{row.employee.section || "-"}</td>
                <td className="border-t border-gray-100 px-3 py-1.5">
                  {row.pattern ? (
                    <span className="text-xs text-gray-700">{patternLabel(row.pattern)}</span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">সেট নেই</span>
                  )}
                </td>
                {row.cells.map((c, i) => {
                  const sh = c.s ? shiftMap.get(c.s) : null;
                  return (
                    <td key={weeks[i]} className={`border-t border-gray-100 p-0.5 text-center ${weeks[i] === currentWeek ? "bg-emerald-50" : ""}`}>
                      <button
                        type="button"
                        onClick={() => openCell(row, i)}
                        title={sh ? `${sh.name}${c.m ? " (Manual)" : ""}` : "প্যাটার্ন নেই"}
                        className={`relative h-7 w-11 rounded border text-[11px] font-semibold ${sh ? colorOf.get(c.s) : "border-dashed border-gray-300 text-gray-300"}`}
                      >
                        {sh ? shortCode(sh) : "–"}
                        {c.m ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">লাল বিন্দু = হাতে বদলানো (Manual) সপ্তাহ। যেকোনো ঘরে ক্লিক করে বদলান।</p>

      {/* Override modal */}
      {editCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{editCell.row.employee.name} ({editCell.row.employee.employeeId})</h2>
                <p className="text-xs text-gray-500">সপ্তাহ শুরু: {weeks[editCell.weekIdx]}</p>
              </div>
              <button type="button" onClick={() => setEditCell(null)}><X size={18} /></button>
            </div>
            <select value={editShift} onChange={(e) => setEditShift(e.target.value)} className={`${input} w-full`}>
              {shifts.map((s) => (<option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>))}
            </select>
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" checked={editScope === "WEEK"} onChange={() => setEditScope("WEEK")} className="mt-1" />
                <span><b>শুধু এই সপ্তাহ</b><br /><span className="text-xs text-gray-500">বাকি সপ্তাহ ও Rotation যেমন ছিল তেমনই থাকবে।</span></span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" checked={editScope === "ONWARD"} onChange={() => setEditScope("ONWARD")} className="mt-1" />
                <span><b>এই সপ্তাহ থেকে সামনে</b><br /><span className="text-xs text-gray-500">শিফটটি কর্মীর Rotate তালিকায় থাকলে এখান থেকে Rotation চলতে থাকবে, নইলে Fixed হবে। বাকি সপ্তাহগুলো নতুন করে বসবে।</span></span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditCell(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">বাতিল</button>
              <button type="button" disabled={busy} onClick={saveOverride} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">সেভ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterPlan;
