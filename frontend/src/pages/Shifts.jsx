import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Plus,
  Pencil,
  Sun,
  Moon,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import api from "../services/api";

const emptyForm = {
  name: "",
  code: "",
  startTime: "08:00",
  endTime: "17:00",
  graceMinutes: 10,
  breakMinutes: 60,
  overtimeAfterMinutes: 0,
  isNightShift: false,
  isActive: true,
  description: "",
};

const toMinutes = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return h * 60 + m;
};

// শিফটের মোট সময় (মিনিট); শেষ সময় শুরুর চেয়ে ছোট বা সমান হলে পরের দিন ধরা হয়
const durationMinutes = (start, end) => {
  let diff = toMinutes(end) - toMinutes(start);
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

const fmtDuration = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

const to12 = (t) => {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
};

const REQUIRED_CODES = ["DAY-01", "NIGHT-01"];

const Shifts = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/shifts");
      setShifts(res.data.shifts || []);
    } catch (err) {
      setError(err.response?.data?.message || "Shift লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const missingRequired = useMemo(
    () =>
      REQUIRED_CODES.filter(
        (code) => !shifts.some((s) => s.code === code && s.isActive),
      ),
    [shifts],
  );

  const visible = useMemo(() => {
    if (status === "active") return shifts.filter((s) => s.isActive);
    if (status === "inactive") return shifts.filter((s) => !s.isActive);
    return shifts;
  }, [shifts, status]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onTimeChange = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // শেষ সময় শুরুর চেয়ে ছোট হলে নাইট শিফট স্বয়ংক্রিয়ভাবে টিক পড়ে
      next.isNightShift = toMinutes(next.endTime) <= toMinutes(next.startTime);
      return next;
    });
  };

  const openCreate = (preset = {}) => {
    setEditingId(null);
    setForm({ ...emptyForm, ...preset });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (shift) => {
    setEditingId(shift._id);
    setForm({
      name: shift.name || "",
      code: shift.code || "",
      startTime: shift.startTime || "08:00",
      endTime: shift.endTime || "17:00",
      graceMinutes: shift.graceMinutes ?? 0,
      breakMinutes: shift.breakMinutes ?? 0,
      overtimeAfterMinutes: shift.overtimeAfterMinutes ?? 0,
      isNightShift: !!shift.isNightShift,
      isActive: shift.isActive !== false,
      description: shift.description || "",
    });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.name.trim() || !form.code.trim()) {
      setError("নাম এবং কোড আবশ্যক");
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      startTime: form.startTime,
      endTime: form.endTime,
      graceMinutes: Number(form.graceMinutes) || 0,
      breakMinutes: Number(form.breakMinutes) || 0,
      overtimeAfterMinutes: Number(form.overtimeAfterMinutes) || 0,
      isNightShift: !!form.isNightShift,
      description: form.description,
    };

    setSaving(true);
    try {
      if (editingId) {
        const res = await api.put(`/shifts/${editingId}`, { ...payload, isActive: form.isActive });
        setMessage(res.data.message || "Shift আপডেট হয়েছে");
      } else {
        const res = await api.post("/shifts", payload);
        setMessage(res.data.message || "Shift তৈরি হয়েছে");
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (shift) => {
    setError("");
    setMessage("");
    const next = !shift.isActive;
    if (
      !next &&
      !window.confirm(
        `"${shift.name}" বন্ধ করলে নতুন Roster Plan-এ এটি আর দেওয়া যাবে না। বন্ধ করবেন?`,
      )
    ) {
      return;
    }
    try {
      await api.put(`/shifts/${shift._id}`, { isActive: next });
      setMessage(next ? "Shift চালু হয়েছে" : "Shift বন্ধ হয়েছে");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "স্ট্যাটাস বদলানো যায়নি");
    }
  };

  const presets = [
    {
      label: "Day (DAY-01)",
      data: { name: "Day Shift", code: "DAY-01", startTime: "08:00", endTime: "17:00", isNightShift: false },
    },
    {
      label: "Night (NIGHT-01)",
      data: { name: "Night Shift", code: "NIGHT-01", startTime: "20:00", endTime: "05:00", isNightShift: true },
    },
  ];

  const formDuration = durationMinutes(form.startTime, form.endTime);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-800">Shift Management</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            শিফট তৈরি করুন, সময় বদলান বা বন্ধ করুন। এখানকার শিফটই Roster Plan ও Weekly Roster-এ ব্যবহার হয়।
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> নতুন Shift
        </button>
      </div>

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5" /> {message}
        </div>
      )}
      {error && !modalOpen && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {error}
        </div>
      )}

      {!loading && missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">
                Active শিফট নেই: {missingRequired.join(", ")}
              </p>
              <p className="mt-0.5 text-xs">
                Day/Night সাপ্তাহিক বদল ও Roster Generate-এর জন্য এই কোডের শিফট লাগে। দ্রুত বানাতে:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {presets
                  .filter((p) => missingRequired.includes(p.data.code))
                  .map((p) => (
                    <button
                      key={p.data.code}
                      type="button"
                      onClick={() => openCreate(p.data)}
                      className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      {p.label} তৈরি করুন
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {[
          ["all", "সব"],
          ["active", "চালু"],
          ["inactive", "বন্ধ"],
        ].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatus(val)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === val
                ? "bg-emerald-600 text-white"
                : "border border-gray-200 bg-white text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">সময়</th>
              <th className="px-4 py-3">মোট</th>
              <th className="px-4 py-3">Grace</th>
              <th className="px-4 py-3">Break</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  লোড হচ্ছে...
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  কোনো Shift নেই। "নতুন Shift" চাপুন।
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((shift) => (
                <tr key={shift._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-800">
                      {shift.isNightShift ? (
                        <Moon size={15} className="text-indigo-600" />
                      ) : (
                        <Sun size={15} className="text-amber-500" />
                      )}
                      {shift.name}
                    </div>
                    {shift.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{shift.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{shift.code}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {to12(shift.startTime)} – {to12(shift.endTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {fmtDuration(durationMinutes(shift.startTime, shift.endTime))}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{shift.graceMinutes || 0} মি.</td>
                  <td className="px-4 py-3 text-gray-600">{shift.breakMinutes || 0} মি.</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        shift.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {shift.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(shift)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(shift)}
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {shift.isActive ? "বন্ধ করুন" : "চালু করুন"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        নোট: শিফটের সময় বদলালে আগের তারিখের হাজিরা নিজে বদলায় না; ওই তারিখ আবার Calculate করলে নতুন সময় ধরবে।
        শিফট মুছে ফেলার ব্যবস্থা নেই, ব্যবহার না হলে "বন্ধ করুন"।
      </p>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? "Shift এডিট" : "নতুন Shift"}
              </h2>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5" /> {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                নাম
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Day Shift"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Code (ইউনিক)
                <input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                  placeholder="DAY-01"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono font-normal"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                শুরুর সময়
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => onTimeChange("startTime", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                শেষের সময়
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => onTimeChange("endTime", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Grace (মিনিট)
                <input
                  type="number"
                  min="0"
                  value={form.graceMinutes}
                  onChange={(e) => setField("graceMinutes", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Break (মিনিট)
                <input
                  type="number"
                  min="0"
                  value={form.breakMinutes}
                  onChange={(e) => setField("breakMinutes", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>
            </div>

            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              মোট সময়: <b>{fmtDuration(formDuration)}</b>
              {form.isNightShift && " · শেষ সময় পরের দিন ধরা হবে (নাইট শিফট)"}
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isNightShift}
                onChange={(e) => setField("isNightShift", e.target.checked)}
              />
              নাইট শিফট (রাত পার হয়ে পরের দিন শেষ হয়)
            </label>

            {editingId && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                />
                Active
              </label>
            )}

            <label className="mt-4 block text-sm font-medium text-gray-700">
              বিবরণ (ঐচ্ছিক)
              <input
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "সেভ হচ্ছে..." : editingId ? "আপডেট করুন" : "তৈরি করুন"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Shifts;
