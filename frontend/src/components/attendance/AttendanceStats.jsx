import {
  ClipboardList,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { getDeviceState } from "../../utils/deviceStatus";

const AttendanceStats = ({ total, history, devices = [] }) => {
  const activeDevices = devices.filter((d) => d.enabled);
  const connectedDevices = activeDevices.filter((d) =>
    ["connected", "online"].includes(getDeviceState(d).key),
  ).length;

  const failedDevices = history.filter(
    (item) => item.status === "Failed",
  ).length;

  const stats = [
    {
      title: "Total Punch Logs",
      value: total,
      icon: ClipboardList,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Connected Devices",
      value: `${connectedDevices}/${activeDevices.length}`,
      icon: Fingerprint,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Latest Successful Syncs",
      value: history.filter((item) => item.status === "Success").length,
      icon: CheckCircle2,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Failed Sync Records",
      value: failedDevices,
      icon: AlertCircle,
      color: "bg-red-100 text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{item.title}</p>
                <h3 className="text-2xl font-bold mt-2 text-slate-800">
                  {item.value}
                </h3>
              </div>

              <div className={`p-3 rounded-lg ${item.color}`}>
                <Icon size={23} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttendanceStats;
