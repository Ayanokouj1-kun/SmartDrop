import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, LogOut, Route, Clock, Shield, ArrowRight } from "lucide-react";
import logo from "@/assets/smartdrop-logo.png";
import MapView from "@/components/MapView";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  useEffect(() => {
    document.title = "Dashboard — SmartDrop";
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/signin", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) navigate("/signin", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin", { replace: true });
  };

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff) {
      toast.error("Please enter both pick-up and drop-off locations.");
      return;
    }
    toast.success(`Searching rides from ${pickup} to ${dropoff}…`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Rider";
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <nav className="container flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <img src={logo} alt="SmartDrop" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-lg tracking-tight">SmartDrop</span>
          </a>
          <div className="flex items-center gap-3">
            {avatar && <img src={avatar} alt="" width={32} height={32} className="rounded-full border border-border" />}
            <span className="hidden sm:inline text-sm text-muted-foreground">{name}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </nav>
      </header>

      <main className="container py-12 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome, <span className="text-gradient-brand">{name.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-2">Plan a trip or explore SmartDrop's concept tools.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 bg-card border-border shadow-card lg:col-span-2">
            <h2 className="font-semibold text-lg mb-4">Book a ride</h2>
            <form onSubmit={handleBook} className="space-y-3">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input placeholder="Pick-up location" value={pickup} onChange={(e) => setPickup(e.target.value)}
                  className="pl-10 bg-secondary border-border h-12" />
              </div>
              <div className="relative">
                <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                <Input placeholder="Drop-off location" value={dropoff} onChange={(e) => setDropoff(e.target.value)}
                  className="pl-10 bg-secondary border-border h-12" />
              </div>
              <Button type="submit" size="lg" className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-12">
                Find a ride <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </Card>

          <Card className="p-6 bg-card border-border shadow-card">
            <h2 className="font-semibold text-lg mb-4">Recent activity</h2>
            <p className="text-sm text-muted-foreground">No trips yet. Your upcoming and past rides will show up here.</p>
          </Card>
        </div>

        <Card className="p-2 bg-card border-border shadow-card overflow-hidden">
          <div className="px-2 pt-1 pb-2 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Your location</h2>
            <span className="text-xs text-muted-foreground">Live map</span>
          </div>
          <div className="w-full h-[420px] rounded-md overflow-hidden">
            <MapView className="w-full h-full" />
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Route, t: "Smarter routing", d: "Suggested paths based on your destination." },
            { icon: Clock, t: "Schedule ahead", d: "Plan pick-ups so you're never waiting." },
            { icon: Shield, t: "Verified drivers", d: "All drivers register before accepting trips." },
          ].map(({ icon: Icon, t, d }) => (
            <Card key={t} className="p-5 bg-card border-border shadow-card flex gap-4 items-start">
              <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow">
                <Icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
