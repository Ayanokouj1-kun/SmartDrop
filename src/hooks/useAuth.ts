import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "driver" | "user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        // defer to avoid Supabase client deadlock
        setTimeout(() => loadAndGuard(session.user), 0);
      } else {
        setUser(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadAndGuard(session.user).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Checks is_active before allowing the session to proceed. */
  async function loadAndGuard(u: User) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("user_id", u.id)
      .single();

    // Only block if a row exists and is explicitly deactivated
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      toast.error("Your account has been deactivated. Contact an administrator.");
      return;
    }

    setUser(u);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }

  const hasRole = (r: AppRole) => roles.includes(r);
  const highest: AppRole = roles.includes("superadmin")
    ? "superadmin"
    : roles.includes("admin")
    ? "admin"
    : roles.includes("driver")
    ? "driver"
    : "user";

  return { user, roles, hasRole, highest, loading };
}
