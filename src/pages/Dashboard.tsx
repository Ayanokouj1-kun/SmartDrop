import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import UserDashboard from "@/pages/UserDashboard";

export default function Dashboard() {
  const { loading, user, hasRole } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (hasRole("superadmin")) return <Navigate to="/superadmin" replace />;
  if (hasRole("admin"))       return <Navigate to="/admin" replace />;
  if (hasRole("driver"))      return <Navigate to="/driver" replace />;
  return <UserDashboard />;
}
