import { useCallback, useEffect, useState } from "react";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import api from "../services/api";

import {
  fetchAttendanceLogs,
  fetchSyncHistory,
  syncAttendance,
} from "../features/attendance/attendanceSlice";

import AttendanceStats from "../components/attendance/AttendanceStats";
import DeviceStatus from "../components/attendance/DeviceStatus";
import AttendanceFilters from "../components/attendance/AttendanceFilters";
import AttendanceTable from "../components/attendance/AttendanceTable";

import {
  RefreshCw,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const defaultFilters = {
  search: "",
  deviceId: "",
  section: "",
  department: "",
  startDate: "",
  endDate: "",
};

const Attendance = () => {
  const dispatch = useAppDispatch();

  const {
    logs,
    history,
    pagination,
    loading,
    syncing,
    error,
    syncError,
    syncResult,
  } = useAppSelector((state) => state.attendance);

  const role = useAppSelector((state) => state.auth.user?.role);
  const canManage = role === "ADMIN" || role === "HR";

  const [filters, setFilters] = useState(defaultFilters);
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceBusy, setDeviceBusy] = useState("");
  const [deviceNote, setDeviceNote] = useState(null); // { type: 'ok' | 'error', text }
  const [filterOptions, setFilterOptions] = useState({
    devices: [],
    sections: [],
    departments: [],
  });

  // Device / Section / Department ড্রপডাউনের তালিকা
  useEffect(() => {
    api
      .get("/attendance/filter-options")
      .then((res) =>
        setFilterOptions({
          devices: res.data.devices || [],
          sections: res.data.sections || [],
          departments: res.data.departments || [],
        }),
      )
      .catch(() => {});
  }, []);

  // এই কোম্পানির ডিভাইস (সর্বশেষ sync অবস্থাসহ)
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get("/devices");
      setDevices(res.data.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const loadLogs = useCallback(
    (page = 1, currentFilters = defaultFilters) => {
      const params = {
        page,
        limit: 50,
      };

      if (currentFilters.deviceId) {
        params.deviceId = currentFilters.deviceId;
      }

      if (currentFilters.section) {
        params.section = currentFilters.section;
      }

      if (currentFilters.department) {
        params.department = currentFilters.department;
      }

      if (currentFilters.search.trim()) {
        params.search = currentFilters.search.trim();
      }

      if (currentFilters.startDate) {
        params.startDate = currentFilters.startDate;
      }

      if (currentFilters.endDate) {
        params.endDate = currentFilters.endDate;
      }

      dispatch(fetchAttendanceLogs(params));
    },
    [dispatch],
  );

  const loadHistory = useCallback(() => {
    dispatch(fetchSyncHistory({ page: 1, limit: 20 }));
  }, [dispatch]);

  useEffect(() => {
    loadLogs(1);
    loadHistory();
    loadDevices();
  }, [loadLogs, loadHistory, loadDevices]);

  const handleSearch = () => {
    loadLogs(1, filters);
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    loadLogs(1, defaultFilters);
  };

  const handlePageChange = (page) => {
    loadLogs(page, filters);
  };

  // Bangladesh local date YYYY-MM-DD
  const getBdToday = () => {
    const now = new Date();
    const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    return bd.toISOString().slice(0, 10);
  };

  const handleSync = async (withCalculate = true) => {
    const options = withCalculate
      ? { autoCalculate: true, calculateDates: [getBdToday()] }
      : {};

    const action = await dispatch(syncAttendance(options));

    if (syncAttendance.fulfilled.match(action)) {
      loadLogs(1, filters);
      loadHistory();
      loadDevices();
    }
  };

  // একটি ডিভাইসের সংযোগ পরীক্ষা
  const handleTestDevice = async (device) => {
    setDeviceBusy(device._id);
    setDeviceNote(null);
    try {
      const res = await api.post(`/devices/${device._id}/test`);
      const r = res.data;
      setDeviceNote({
        type: r.ok ? "ok" : "error",
        text: `${device.name}: ${r.message}${r.ms ? ` (${r.ms} ms)` : ""}${r.error ? ` — ${r.error}` : ""}${r.hint ? ` ${r.hint}` : ""}`,
      });
    } catch (e) {
      setDeviceNote({ type: "error", text: `${device.name}: ${e.response?.data?.message || "পরীক্ষা করা যায়নি"}` });
    } finally {
      setDeviceBusy("");
    }
  };

  // শুধু একটি ডিভাইস থেকে punch আনা
  const handleSyncDevice = async (device) => {
    setDeviceBusy(device._id);
    setDeviceNote(null);
    try {
      const res = await api.post(`/devices/${device._id}/sync`);
      const r = res.data.result;
      if (r.status === "Failed") {
        setDeviceNote({ type: "error", text: `${device.name}: Sync ব্যর্থ — ${r.error}${r.hint ? ` ${r.hint}` : ""}` });
      } else {
        setDeviceNote({
          type: "ok",
          text: `${device.name}: ${r.insertedRecords || 0} নতুন, ${r.duplicateRecords || 0} duplicate`,
        });
        loadLogs(1, filters);
        loadHistory();
      }
    } catch (e) {
      setDeviceNote({ type: "error", text: `${device.name}: ${e.response?.data?.message || "Sync করা যায়নি"}` });
    } finally {
      setDeviceBusy("");
      loadDevices();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Fingerprint className="text-emerald-600" size={25} />
            <h1 className="text-2xl font-bold text-slate-800">
              Attendance Management
            </h1>
          </div>

          <p className="text-sm text-slate-500 mt-2">
            Manage employee punch records and ZKTeco devices.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="flex items-center justify-center gap-2 border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 px-4 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            Sync All Devices
          </button>
          <button
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Synchronizing..." : "Sync + Calculate Today"}
          </button>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <CheckCircle2 size={20} />
            Attendance Sync Completed
          </div>

          <div className="flex flex-wrap gap-5 mt-3 text-sm text-emerald-800">
            <span>Total Devices: {syncResult.summary?.totalDevices ?? 0}</span>
            <span>Success: {syncResult.summary?.success ?? 0}</span>
            <span>Partial: {syncResult.summary?.partial ?? 0}</span>
            <span>Failed: {syncResult.summary?.failed ?? 0}</span>
          </div>

          {syncResult.results?.map((item) => (
            <p key={item.deviceId} className="text-xs mt-2 text-emerald-800">
              {item.deviceName}: {item.insertedRecords || 0} new,{" "}
              {item.duplicateRecords || 0} duplicate, {item.invalidRecords || 0}{" "}
              invalid
              {item.skippedOld ? `, ${item.skippedOld} old skipped` : ""}
              {item.error ? ` — ${item.error}` : ""}
            </p>
          ))}

          {syncResult.calculationResults?.length > 0 && (
            <div className="mt-3 border-t border-emerald-200 pt-3">
              <p className="text-sm font-medium text-emerald-900">
                Daily calculation:
              </p>
              {syncResult.calculationResults.map((c) => (
                <p key={c.date} className="text-xs mt-1 text-emerald-800">
                  {c.date}:{" "}
                  {c.success
                    ? `Processed ${c.processed}, Present ${c.present}, Late ${c.late}, Absent ${c.absent}, Incomplete ${c.incomplete}`
                    : `Failed — ${c.error}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {syncResult?.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm flex gap-2">
          <AlertCircle size={18} className="shrink-0" />
          {syncResult.warning}
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
          <AlertCircle size={18} />
          {syncError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Statistics */}
      <AttendanceStats total={pagination.total} history={history} devices={devices} />

      {/* Device Status */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          ZKTeco Device Status
        </h2>

        {deviceNote && (
          <div
            className={`mb-4 rounded-xl border p-3 text-sm ${
              deviceNote.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {deviceNote.text}
          </div>
        )}

        <DeviceStatus
          devices={devices}
          loading={devicesLoading}
          busy={deviceBusy}
          canManage={canManage}
          onTest={handleTestDevice}
          onSync={handleSyncDevice}
        />
      </div>

      {/* Filters */}
      <AttendanceFilters
        filters={filters}
        setFilters={setFilters}
        onSearch={handleSearch}
        onReset={handleReset}
        options={filterOptions}
      />

      {/* Table */}
      <AttendanceTable
        logs={logs}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default Attendance;
