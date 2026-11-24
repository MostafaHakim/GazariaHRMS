import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, TOKEN_KEY } from "./api.js";

const TZ = "Asia/Dhaka";
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const fmtClock = (d) =>
  new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour12: false });
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD (ঢাকা)
const fmtDateLabel = (s) =>
  new Date(`${s}T12:00:00+06:00`).toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username: username.trim(), password },
      });
      if (data.user.role !== "SECURITY")
        throw new ApiError(
          "এই অ্যাপে শুধু সিকিউরিটি অ্যাকাউন্ট ঢুকতে পারবে",
          403,
        );
      localStorage.setItem(TOKEN_KEY, data.token);
      onDone(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Gazaria Group</h1>
        <p className="muted">MegaBox</p>
        {error && <div className="alert err">{error}</div>}
        <input
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn primary" disabled={busy}>
          {busy ? "..." : "Login"}
        </button>
      </form>
    </div>
  );
}

function Board({ user, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notAllowed, setNotAllowed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL | IN | OUT
  const [date, setDate] = useState(todayStr());
  const [confirm, setConfirm] = useState(null); // { emp, action }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState(new Date());

  const isToday = date === todayStr();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await api(`/punch/employees?date=${date}`);
        setEmployees(data.employees);
        setNotAllowed(data.allowedHere === false);
        setError("");
      } catch (e) {
        if (e.status === 401) return onLogout();
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [date, onLogout],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const doPunch = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const data = await api(
        `/punch/employees/${confirm.emp.id}/${confirm.action === "IN" ? "in" : "out"}`,
        { method: "POST" },
      );
      setToast(`${confirm.emp.name} — ${confirm.action} ${fmtTime(data.time)}`);
      setConfirm(null);
      await load(true);
    } catch (e) {
      if (e.status === 401) return onLogout();
      setError(e.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(
    () => ({
      IN: employees.filter((e) => e.state === "IN").length,
      total: employees.length,
    }),
    [employees],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (filter !== "ALL" && e.state !== filter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.nameBangla.includes(search.trim()) ||
        e.employeeId.toLowerCase().includes(q)
      );
    });
  }, [employees, search, filter]);

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <b>{user.name}</b>
          <div className="muted small">
            {fmtClock(clock)} · {counts.IN}/{counts.total} এখন IN
          </div>
        </div>
        <button className="btn ghost" onClick={onLogout}>
          Logout
        </button>
      </header>

      <div className="tools">
        <input
          placeholder="নাম বা ID খুঁজুন"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value || todayStr())}
        />
      </div>
      <div className="tabs">
        {["ALL", "IN", "OUT"].map((f) => (
          <button
            key={f}
            className={filter === f ? "tab on" : "tab"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "সবাই" : f}
          </button>
        ))}
      </div>

      {!isToday && (
        <div className="alert warn">
          {fmtDateLabel(date)} এর পাঞ্চ দেখছেন — শুধু দেখা যাবে, পাঞ্চ দেওয়া
          যাবে না।
        </div>
      )}
      {notAllowed && (
        <div className="alert warn">
          এই নেটওয়ার্ক থেকে পাঞ্চ দেওয়া যাবে না।
        </div>
      )}
      {error && (
        <div className="alert err" onClick={() => setError("")}>
          {error}
        </div>
      )}
      {loading && <p className="muted center-text">Loading...</p>}
      {!loading && shown.length === 0 && (
        <p className="muted center-text">কোনো কর্মী পাওয়া যায়নি</p>
      )}

      <ul className="list">
        {shown.map((e) => {
          const canIn = isToday && !notAllowed && e.state !== "IN";
          const canOut = isToday && !notAllowed && e.state === "IN";
          return (
            <li key={e.id} className="card emp">
              <div className="row">
                <div>
                  <div className="name">{e.nameBangla || e.name}</div>
                  <div className="muted small">
                    ID {e.employeeId}
                    {e.section ? ` · ${e.section}` : ""}
                  </div>
                </div>
                <span className={e.state === "IN" ? "badge in" : "badge out"}>
                  {e.state === "IN" ? `IN ${fmtTime(e.lastPunch.time)}` : "OUT"}
                </span>
              </div>
              <div className="punches">
                {e.punches.length === 0 ? (
                  <span className="muted small">
                    {isToday ? "আজ কোনো পাঞ্চ নেই" : "এই দিনে কোনো পাঞ্চ নেই"}
                  </span>
                ) : (
                  e.punches.map((p, i) => (
                    <span
                      key={i}
                      className={p.action === "IN" ? "chip in" : "chip out"}
                    >
                      {p.action} {fmtTime(p.time)}
                    </span>
                  ))
                )}
              </div>
              <div className="btns">
                <button
                  className="btn in"
                  disabled={!canIn}
                  onClick={() => setConfirm({ emp: e, action: "IN" })}
                >
                  IN
                </button>
                <button
                  className="btn out"
                  disabled={!canOut}
                  onClick={() => setConfirm({ emp: e, action: "OUT" })}
                >
                  OUT
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {confirm && (
        <div className="sheet-bg" onClick={() => !busy && setConfirm(null)}>
          <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
            <p className="muted small">
              নিশ্চিত করুন — পাঞ্চ পরে বদলানো যাবে না
            </p>
            <h2>{confirm.emp.nameBangla || confirm.emp.name}</h2>
            <p className="muted">ID {confirm.emp.employeeId}</p>
            <div className={confirm.action === "IN" ? "big in" : "big out"}>
              {confirm.action} — এখন {fmtClock(clock)}
            </div>
            <div className="btns">
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                বাতিল
              </button>
              <button
                className={confirm.action === "IN" ? "btn in" : "btn out"}
                disabled={busy}
                onClick={doPunch}
              >
                {busy ? "..." : `${confirm.action} দিন`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(
    Boolean(localStorage.getItem(TOKEN_KEY)),
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api("/auth/me")
      .then((d) => (d.user.role === "SECURITY" ? setUser(d.user) : logout()))
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout]);

  if (checking)
    return (
      <div className="center">
        <p className="muted">Loading...</p>
      </div>
    );
  return user ? (
    <Board user={user} onLogout={logout} />
  ) : (
    <Login onDone={setUser} />
  );
}
