// ডিভাইসের বর্তমান অবস্থা বের করার সহায়ক (Attendance ও Devices পেজ দুটোই ব্যবহার করে)
const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export const getDeviceState = (device) => {
  if (!device.enabled) return { key: "disabled", label: "Disabled", tone: "slate" };

  if (device.protocol === "ADMS") {
    const seen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    if (seen && Date.now() - seen < ONLINE_WINDOW_MS) return { key: "online", label: "Online (ADMS)", tone: "emerald" };
    if (seen) return { key: "offline", label: "Offline (ADMS)", tone: "red" };
    return { key: "waiting", label: "Waiting for device", tone: "amber" };
  }

  const status = device.lastSync?.status;
  if (status === "Success" || status === "Partial") return { key: "connected", label: "Connected", tone: "emerald" };
  if (status === "Failed") return { key: "failed", label: "Connection failed", tone: "red" };
  return { key: "new", label: "Not synced yet", tone: "slate" };
};

export const isDeviceConnected = (device) => ["connected", "online"].includes(getDeviceState(device).key);

export const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
};

export const formatDhaka = (value) =>
  value ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "";
