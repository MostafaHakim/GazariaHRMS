const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "emerald",
}) => {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <h3 className="mt-3 text-3xl font-bold text-slate-800">{value}</h3>

          <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color] || colors.emerald}`}>
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
