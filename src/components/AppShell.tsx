import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";
import logo from "@/assets/smartdrop-logo.png";

interface NavItem {
  to: string;
  label: string;
}

export default function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const { user, highest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "User";
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const roleColor =
    highest === "superadmin" ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
    : highest === "admin" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <nav className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SmartDrop" width={32} height={32} className="rounded-lg" />
            <span className="font-bold tracking-tight">SmartDrop</span>
            <Badge className={`ml-2 border ${roleColor}`}>{highest}</Badge>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {nav.map((n) => (
              <Link key={n.to} to={n.to}
                className={`hover:text-foreground transition-smooth ${location.pathname === n.to ? "text-foreground font-medium" : ""}`}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {avatar && <img src={avatar} alt="" width={28} height={28} className="rounded-full border border-border" />}
            <span className="hidden sm:inline text-sm text-muted-foreground max-w-[160px] truncate">{name}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </nav>
      </header>
      <main className="container py-8 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
