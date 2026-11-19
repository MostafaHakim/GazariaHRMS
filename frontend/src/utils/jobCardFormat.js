export const formatTime = (date) => {
  if (!date) return "--";
  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatDate = (date) => {
  if (!date) return "-";
  return String(date).slice(0, 10);
};

export const formatDuration = (minutes = 0) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

export const statusClass = {
  PRESENT: "text-green-700",
  LATE: "text-orange-600",
  ABSENT: "text-red-600",
  INCOMPLETE: "text-purple-600",
  WEEKLY_OFF: "text-gray-500",
  HOLIDAY: "text-blue-600",
  LEAVE: "text-yellow-700",
};
