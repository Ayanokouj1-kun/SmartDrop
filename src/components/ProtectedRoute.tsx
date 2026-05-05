import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
  requireRole?: AppRole;
}

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, hasRole, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (requireRole && !hasRole(requireRole)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
