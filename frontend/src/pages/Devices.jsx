import { useCallback, useEffect, useState } from "react";
import { Router, Plus, RefreshCw, Save, Power, Link2, Plug, Loader2, Download } from "lucide-react";
import api from "../services/api";
import { useAppSelector } from "../hooks/useAppSelector";
import { getDeviceState, toneClasses, formatDhaka } from "../utils/deviceStatus";

const empty = {
  deviceId: "",
  name: "",
  serialNumber: "",
  model: "",
  ip: "",
  port: 4370,
  commKey: 0,
  protocol: "PULL",
  enabled: true,
};

const inputClass = "mt-1 w-full rounded-lg border px-3 py-2";

export default function Devices() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canManage = role === "ADMIN" || role === "HR";
  const { companies, activeCompanyId } = useAppSelector((s) => s.company);
  const activeCompany = companies.find((c) => String(c._id) === String(activeCompanyId));

  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdms = form.protocol === "ADMS";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/devices");
      setDevices(r.data.devices || []);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "ডিভাইস লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((v) => ({ ...v, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (editing) await api.put(`/devices/${editing}`, form);
      else await api.post("/devices", form);
      setForm(empty);
      setEditing("");
      setMessage("ডিভাইস সংরক্ষণ হয়েছে");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  };

  const edit = (d) => {
    setEditing(d._id);
    setForm({ ...empty, ...d, serialNumber: d.serialNumber || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditing("");
    setForm(empty);
  };

  const testDevice = async (d) => {
    setRowBusy(d._id);
    setMessage("");
    setError("");
    try {
      const { data } = await api.post(`/devices/${d._id}/test`);
      const text = `${d.name}: ${data.message}${data.ms ? ` (${data.ms} ms)` : ""}${
        data.info?.logCounts !== undefined ? ` — ডিভাইসে ${data.info.logCounts} টি punch আছে` : ""
      }`;
      if (data.ok) setMessage(text);
      else setError(`${text}${data.error ? ` — ${data.error}` : ""}${data.hint ? ` ${data.hint}` : ""}`);
    } catch (err) {
      setError(err.response?.data?.message || "পরীক্ষা করা যায়নি");
    } finally {
      setRowBusy("");
    }
  };

  const syncDevice = async (d) => {
    setRowBusy(d._id);
    setMessage("");
    setError("");
    try {
      const { data } = await api.post(`/devices/${d._id}/sync`);
      const r = data.result;
      if (r.status === "Failed") setError(`${d.name}: Sync ব্যর্থ — ${r.error}${r.hint ? ` ${r.hint}` : ""}`);
      else setMessage(`${d.name}: ${r.insertedRecords || 0} টি নতুন punch, ${r.duplicateRecords || 0} টি duplicate`);
    } catch (err) {
      setError(err.response?.data?.message || "Sync করা যায়নি");
    } finally {
      setRowBusy("");
      load();
    }
  };

  const mapEmployee = async (d) => {
    const employeeId = window.prompt("HRMS Employee ID লিখুন");
    if (!employeeId) return;
    const deviceUserId = window.prompt("ডিভাইসের User ID / PIN লিখুন");
    if (!deviceUserId) return;
    try {
      await api.post(`/devices/${d._id}/map-employee`, { employeeId, deviceUserId });
      setMessage(`${employeeId} এর Device Mapping সংরক্ষিত হয়েছে`);
    } catch (err) {
      setError(err.response?.data?.message || "Mapping করা যায়নি");
    }
  };

  const disable = async (id) => {
    if (!window.confirm("এই ডিভাইসটি Disable করবেন?")) return;
    try {
      await api.delete(`/devices/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Disable করা যায়নি");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Devices</h1>
          <p className="text-sm text-slate-500">
            কোম্পানি: <b className="text-slate-700">{activeCompany?.name || "—"}</b> — এই কোম্পানির ডিভাইস আলাদাভাবে যোগ, পরীক্ষা ও Sync করুন
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && <div className="rounded-lg bg-green-50 p-3 text-green-700">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      {canManage && (
        <form onSubmit={save} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
          <h2 className="md:col-span-3 flex items-center gap-2 font-semibold">
            <Plus size={18} />
            {editing ? "ডিভাইস Edit" : "নতুন ডিভাইস যোগ করুন"}
          </h2>

          <label className="text-sm text-slate-600">
            Protocol
            <select value={form.protocol} onChange={(e) => setField("protocol", e.target.value)} className={inputClass}>
              <option value="PULL">PULL (LAN — সার্ভার ডিভাইসে IP দিয়ে কানেক্ট করে)</option>
              <option value="ADMS">ADMS Push (ডিভাইস নিজে সার্ভারে পাঠায়)</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Device ID*
            <input required value={form.deviceId} onChange={(e) => setField("deviceId", e.target.value)} className={inputClass} placeholder="K40-01" />
          </label>
          <label className="text-sm text-slate-600">
            Device Name*
            <input required value={form.name} onChange={(e) => setField("name", e.target.value)} className={inputClass} placeholder="Attendance Machine 01" />
          </label>

          {!isAdms && (
            <>
              <label className="text-sm text-slate-600">
                IP Address*
                <input required value={form.ip} onChange={(e) => setField("ip", e.target.value)} className={inputClass} placeholder="192.168.0.134" />
              </label>
              <label className="text-sm text-slate-600">
                Port
                <input type="number" value={form.port} onChange={(e) => setField("port", Number(e.target.value))} className={inputClass} />
              </label>
              <label className="text-sm text-slate-600">
                Comm Key
                <input type="number" value={form.commKey} onChange={(e) => setField("commKey", Number(e.target.value))} className={inputClass} />
              </label>
            </>
          )}

          <label className="text-sm text-slate-600">
            Serial Number{isAdms ? "*" : " (ঐচ্ছিক)"}
            <input required={isAdms} value={form.serialNumber} onChange={(e) => setField("serialNumber", e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm text-slate-600">
            Model
            <input value={form.model} onChange={(e) => setField("model", e.target.value)} className={inputClass} placeholder="K40" />
          </label>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setField("enabled", e.target.checked)} />
            <span className="text-sm">Enabled</span>
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              <Save size={16} />
              {busy ? "Saving..." : "Save Device"}
            </button>
            {editing && (
              <button type="button" onClick={cancelEdit} className="rounded-lg border px-4 py-2">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {["Device", "Connection", "Protocol", "Status", "Last Activity", "Actions"].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-6 text-center text-slate-500">
                  এই কোম্পানিতে কোনো ডিভাইস যোগ করা হয়নি
                </td>
              </tr>
            ) : (
              devices.map((d) => {
                const state = getDeviceState(d);
                const isPull = d.protocol !== "ADMS";
                const isRowBusy = rowBusy === d._id;
                const last = isPull ? d.lastSync?.completedAt || d.lastSync?.createdAt : d.lastSeenAt;

                return (
                  <tr key={d._id} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Router size={17} />
                        <div>
                          <b>{d.name}</b>
                          <div className="text-xs text-slate-500">
                            {d.deviceId} {d.model && `• ${d.model}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {isPull ? `${d.ip || "—"}:${d.port || 4370}` : <span className="text-xs">SN: {d.serialNumber || "—"}</span>}
                    </td>
                    <td className="p-3">{d.protocol}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[state.tone]}`}>{state.label}</span>
                      {isPull && d.lastSync?.status === "Failed" && d.lastSync.errorMessage && (
                        <div className="mt-1 max-w-[220px] text-xs text-red-600">{d.lastSync.errorMessage}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-500">{last ? formatDhaka(last) : "—"}</td>
                    <td className="p-3">
                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          {d.enabled && (
                            <button
                              onClick={() => testDevice(d)}
                              disabled={isRowBusy}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 disabled:opacity-60"
                              title="সংযোগ পরীক্ষা"
                            >
                              {isRowBusy ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Test
                            </button>
                          )}
                          {d.enabled && isPull && (
                            <button
                              onClick={() => syncDevice(d)}
                              disabled={isRowBusy}
                              className="inline-flex items-center gap-1 rounded border border-emerald-600 px-2 py-1 text-emerald-700 disabled:opacity-60"
                              title="শুধু এই ডিভাইস থেকে punch আনুন"
                            >
                              <Download size={14} /> Sync
                            </button>
                          )}
                          <button onClick={() => edit(d)} className="rounded border px-2 py-1">
                            Edit
                          </button>
                          <button onClick={() => mapEmployee(d)} className="inline-flex items-center gap-1 rounded border px-2 py-1">
                            <Link2 size={14} /> Map
                          </button>
                          {d.enabled && (
                            <button onClick={() => disable(d._id)} className="rounded border px-2 py-1 text-red-600" title="Disable">
                              <Power size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
        <p>
          <b>PULL (LAN):</b> সার্ভার কম্পিউটার ও ডিভাইস একই নেটওয়ার্কে থাকতে হবে। Sync করলে সার্ভার ডিভাইসের IP-তে গিয়ে punch নিয়ে আসে। ডিভাইসের Serial Number লাগে না।
        </p>
        <p>
          <b>ADMS Push:</b> ডিভাইসের Serial Number অবশ্যই মেশিনের আসল SN হতে হবে এবং একই SN একাধিক কোম্পানিতে ব্যবহার করা যাবে না। এই ধরনের ডিভাইসে Sync বোতাম লাগে না — ডিভাইস নিজেই পাঠায়।
        </p>
      </div>
    </div>
  );
}
