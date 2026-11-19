import { Users, CheckCircle, Clock, XCircle, AlertCircle, Moon, CalendarOff } from "lucide-react";

const AttendanceSummary = ({ summary }) => {
  const s = summary || {};

  const cards = [
    { title: "Total", value: s.total || 0, icon: Users, color: "bg-blue-50 text-blue-600" },
    { title: "Present", value: (s.present || 0) + (s.late || 0), sub: s.late ? `Late: ${s.late}` : "", icon: CheckCircle, color: "bg-green-50 text-green-600" },
    { title: "Late", value: (s.late || 0) + (s.incompleteLate || 0), sub: "শিফট শুরুর ১০ মিনিটের বেশি", icon: Clock, color: "bg-orange-50 text-orange-600" },
    { title: "Absent", value: s.absent || 0, icon: XCircle, color: "bg-red-50 text-red-600" },
    { title: "Leave", value: s.leave || 0, icon: CalendarOff, color: "bg-yellow-50 text-yellow-600" },
    { title: "Night", value: s.night || 0, icon: Moon, color: "bg-indigo-50 text-indigo-600" },
    { title: "Incomplete", value: s.incomplete || 0, icon: AlertCircle, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{item.title}</p>
                <h3 className="mt-2 text-2xl font-bold text-gray-800">{item.value}</h3>
                {item.sub && <p className="mt-0.5 text-xs text-orange-600">{item.sub}</p>}
              </div>
              <div className={`rounded-lg p-3 ${item.color}`}>
                <Icon size={22} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttendanceSummary;
