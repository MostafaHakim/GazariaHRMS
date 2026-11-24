import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { fetchMe, logout } from "../../features/auth/authSlice";

// roles দিলে শুধু সেই রোলরা ঢুকতে পারবে
const ProtectedRoute = ({ roles }) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { token, user, initializing } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (token && !user) dispatch(fetchMe());
  }, [dispatch, token, user]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (initializing || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> Loading...
      </div>
    );
  }

  // SECURITY লগইন শুধু আলাদা Punch অ্যাপের জন্য; এই প্যানেলে ঢুকলে লগআউটের অপশন দিই
  if (user.role === "SECURITY") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-slate-600">
        <p>এই অ্যাকাউন্ট শুধু Punch অ্যাপে ব্যবহারযোগ্য।</p>
        <button onClick={() => dispatch(logout())} className="rounded-lg border bg-white px-4 py-2 text-sm">Logout</button>
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
