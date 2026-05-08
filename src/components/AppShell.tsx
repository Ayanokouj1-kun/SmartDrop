import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Settings } from "lucide-react";
import logo from "@/assets/smartdrop-logo.png";
import ProfileSettings from "@/components/ProfileSettings";

interface NavItem { to: string; label: string; }

/** Avatar bubble — remounts cleanly via `key` whenever src changes */
function Avatar({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();
  if (!src || broken) {
    return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600
                      flex items-center justify-center text-[11px] font-bold text-white
                      border border-border shrink-0">
        {initials}
      </div>
    );
  }
  return (
    <img src={src} alt={name} width={28} height={28}
      className="w-7 h-7 rounded-full border border-border object-cover shrink-0"
      onError={() => setBroken(true)} />
  );
}

export default function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const { user, highest } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const seqRef    = useRef(0); // stale-fetch guard

  const [displayName, setDisplayName] = useState("User");
  const [avatarUrl,   setAvatarUrl]   = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const seq = ++seqRef.current;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (seq !== seqRef.current) return; // a newer call started — discard
        if (error) console.warn("[AppShell] profile fetch:", error.message);
        setDisplayName(
          data?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email || "User"
        );
        setAvatarUrl(
          data?.avatar_url ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture || ""
        );
      });
  }, [user?.id]);

  const roleColor =
    highest === "superadmin" ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
    : highest === "admin"    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    :                          "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <nav className="container flex items-center justify-between h-14 md:h-16">

          <div className="flex items-center gap-2">
            <img src={logo} alt="SmartDrop" width={32} height={32} className="rounded-lg" />
            <span className="font-bold tracking-tight">SmartDrop</span>
            <Badge className={`ml-2 border ${roleColor}`}>{highest}</Badge>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {nav.map((n) => (
              <Link key={n.to} to={n.to}
                className={`hover:text-foreground transition-smooth ${
                  location.pathname === n.to ? "text-foreground font-medium" : ""
                }`}>
                {n.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors group">
              {/* key forces a fresh mount (broken=false) whenever the URL changes */}
              <Avatar key={avatarUrl || "__init__"} src={avatarUrl} name={displayName} />
              <span className="hidden sm:inline text-sm text-muted-foreground group-hover:text-foreground
                               max-w-[140px] truncate transition-colors">
                {displayName}
              </span>
              <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground
                                  transition-colors hidden sm:block" />
            </button>
            <Button variant="ghost" size="sm" onClick={async () => {
              await supabase.auth.signOut();
              navigate("/signin", { replace: true });
            }} className="gap-1.5">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </nav>
      </header>

      <main className="container py-4 sm:py-6 md:py-8 space-y-4 md:space-y-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {children}
      </main>

      <footer className="border-t border-border mt-12">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SmartDrop. All rights reserved.</span>
          <span>Powered by SmartDrop — Ride with ease, arrive with confidence.</span>
        </div>
      </footer>

      <ProfileSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(name, url) => {
          // Directly apply — no re-fetch needed, these are the exact values just saved
          setDisplayName(name || "User");
          setAvatarUrl(url ?? "");
        }}
      />
    </div>
  );
}
