import { Fingerprint, RefreshCw, Plug, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getDeviceState, toneClasses, formatDhaka } from "../../utils/deviceStatus";

// devices = এই কোম্পানির ডিভাইস (lastSync সহ); প্রতিটি ডিভাইস আলাদাভাবে Test / Sync করা যায়
const DeviceStatus = ({ devices, loading, busy, canManage, onTest, onSync }) => {
  if (loading && devices.length === 0) {
    return <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-400">Loading devices...</div>;
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        এই কোম্পানিতে কোনো ডিভাইস যোগ করা নেই।{" "}
        <Link to="/devices" className="font-semibold underline">
          Attendance Devices
        </Link>{" "}
        পেজ থেকে ডিভাইস যোগ করুন।
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => {
        const state = getDeviceState(device);
        const last = device.lastSync;
        const isBusy = busy === device._id;
        const isPull = device.protocol !== "ADMS";

        return (
          <div key={device._id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
                  <Fingerprint size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{device.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {device.deviceId} · {isPull ? `${device.ip || "—"}:${device.port || 4370}` : `ADMS · SN ${device.serialNumber || "—"}`}
                  </p>
                </div>
              </div>
              <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[state.tone]}`}>
                {state.label}
              </span>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              {isPull ? (
                last ? (
                  <>
                    <p>
                      Last Sync: {formatDhaka(last.completedAt || last.createdAt)} · {last.insertedRecords || 0} New
                    </p>
                    {last.status === "Failed" && last.errorMessage && (
                      <p className="mt-1 text-red-600">{last.errorMessage}</p>
                    )}
                  </>
                ) : (
                  <p>এখনো কোনো Sync হয়নি</p>
                )
              ) : device.lastSeenAt ? (
                <p>Last signal: {formatDhaka(device.lastSeenAt)}</p>
              ) : (
                <p>ডিভাইস এখনো সংকেত পাঠায়নি</p>
              )}
            </div>

            {canManage && device.enabled && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onTest(device)}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Test
                </button>
                {isPull && (
                  <button
                    onClick={() => onSync(device)}
                    disabled={isBusy}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={isBusy ? "animate-spin" : ""} /> Sync
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DeviceStatus;
