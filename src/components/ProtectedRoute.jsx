import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ admin = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to={admin ? "/admin/login" : "/login"} replace state={{ from: location }} />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
