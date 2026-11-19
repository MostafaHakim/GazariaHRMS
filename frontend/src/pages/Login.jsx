import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  Factory,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { login, clearAuthError } from "../features/auth/authSlice";

const Login = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { token, user, loading, error } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({ username: "", password: "" });
  const [show, setShow] = useState(false);

  useEffect(() => () => dispatch(clearAuthError()), [dispatch]);

  if (token && user) {
    return (
      <Navigate to={location.state?.from?.pathname || "/dashboard"} replace />
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(
      login({ username: form.username.trim(), password: form.password }),
    );
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-200 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-3 text-white">
            <Factory size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">GAZARIA</h1>
            <p className="text-[11px] tracking-[3px] text-emerald-400">
              HR MANAGEMENT
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-7 shadow-2xl"
        >
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gazaria Elastic Industries Limited
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="username"
            >
              Username
            </label>
            <input
              id="username"
              autoFocus
              autoComplete="username"
              className={inputClass}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className={`${inputClass} pr-11`}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !form.username || !form.password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LogIn size={17} />
            )}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
