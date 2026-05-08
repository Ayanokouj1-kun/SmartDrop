import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MapPin, Navigation2, DollarSign, CheckCircle2, X,
  Car, Calendar, Zap, User, TrendingUp,
} from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  status: string;
  amount: number;
  user_id: string;
  service_id: string;
  branch_id: string;
  notes: string | null;
}
interface Profile { user_id: string; display_name: string | null; email: string | null; }
interface Service { id: string; name: string; }
interface Branch  { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  pending:    "border-amber-500/40 text-amber-400",
  confirmed:  "border-cyan-500/40 text-cyan-400",
  picked_up:  "border-blue-500/40 text-blue-400",
  on_the_way: "border-violet-500/40 text-violet-400",
  completed:  "border-emerald-500/40 text-emerald-400",
  cancelled:  "border-red-500/40 text-red-400",
  rejected:   "border-gray-500/40 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pending",
  confirmed:  "Accepted",
  picked_up:  "Picked Up",
  on_the_way: "On The Way",
  completed:  "Completed",
  cancelled:  "Cancelled",
  rejected:   "Declined",
};

export default function DriverDashboard() {
  const { user } = useAuth();
  const [activeBookings,  setActiveBookings]  = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [profiles,  setProfiles]  = useState<Profile[]>([]);
  const [services,  setServices]  = useState<Service[]>([]);
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [onDuty,    setOnDuty]    = useState(true);

  useEffect(() => { void load(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("driver-bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  async function load() {
    if (!user) return;
    const [queue, active, hist, svc, br] = await Promise.all([
      // Queue: unassigned pending rides OR pending rides pre-assigned to this driver
      supabase.from("bookings").select("*").eq("status", "pending")
        .or(`driver_id.is.null,driver_id.eq.${user.id}`)
        .order("booking_date", { ascending: true }),
      // Active: my in-progress rides (confirmed / picked_up / on_the_way)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("bookings") as any).select("*")
        .in("status", ["confirmed", "picked_up", "on_the_way"]).eq("driver_id", user.id)
        .order("booking_date", { ascending: true }),
      // History: completed/rejected/cancelled rides this driver handled
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("bookings") as any).select("*").in("status", ["completed", "rejected", "cancelled"])
        .eq("driver_id", user.id)
        .order("booking_date", { ascending: false }).limit(40),
      supabase.from("services").select("id, name"),
      supabase.from("branches").select("id, name"),
    ]);
    const qData = (queue.data ?? []) as Booking[];
    const aData = (active.data ?? []) as Booking[];
    const hData = (hist.data  ?? []) as Booking[];
    setActiveBookings([...qData, ...aData]);
    setHistoryBookings(hData);
    setServices((svc.data ?? []) as Service[]);
    setBranches((br.data  ?? []) as Branch[]);
    const uids = [...new Set([...qData, ...aData, ...hData].map((b) => b.user_id))];
    if (uids.length > 0) {
      const { data: prof } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", uids);
      setProfiles((prof ?? []) as Profile[]);
    }
  }

  const pending    = useMemo(() => activeBookings.filter((b) => b.status === "pending"), [activeBookings]);
  const inProgress = useMemo(() => activeBookings.filter((b) => ["confirmed", "picked_up", "on_the_way"].includes(b.status)), [activeBookings]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const completedToday = useMemo(
    () => historyBookings.filter((b) => b.status === "completed" && new Date(b.booking_date) >= today),
    [historyBookings, today],
  );
  const earningsToday = useMemo(
    () => completedToday.reduce((s, b) => s + Number(b.amount), 0),
    [completedToday],
  );
  const startOfWeek = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d; }, []);
  const earningsWeek = useMemo(
    () => historyBookings.filter((b) => b.status === "completed" && new Date(b.booking_date) >= startOfWeek).reduce((s, b) => s + Number(b.amount), 0),
    [historyBookings, startOfWeek],
  );

  const parseNotes  = (notes: string | null) => { try { return notes ? JSON.parse(notes) : null; } catch { return null; } };
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Service";
  const branchName  = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const customerName = (uid: string) => {
    const p = profiles.find((p) => p.user_id === uid);
    return p?.display_name ?? p?.email?.split("@")[0] ?? "Customer";
  };

  async function updateStatus(id: string, status: string) {
    if (status === "confirmed" && user) {
      // Only accept rides that were pre-assigned by an admin (driver_id = user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("bookings") as any)
        .update({ status: "confirmed", driver_id: user.id })
        .eq("id", id).eq("status", "pending")
        .eq("driver_id", user.id)
        .select("id");
      if (error) return toast.error(error.message);
      if (!data || data.length === 0) {
        toast.error("You can only accept rides assigned to you by an admin.");
        void load();
        return;
      }
      toast.success("Ride accepted!");
      void load();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("bookings") as any).update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    const labels: Record<string, string> = { completed: "Ride completed!", rejected: "Ride declined." };
    toast.success(labels[status] ?? "Status updated");
    void load();
  }

  function BookingCard({ b }: { b: Booking }) {
    const meta = parseNotes(b.notes);
    return (
      <div className="p-4 rounded-xl bg-secondary border border-border space-y-3">
        {/* Customer + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="font-medium text-sm">{customerName(b.user_id)}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[b.status] ?? ""}`}>
            {STATUS_LABELS[b.status] ?? b.status}
          </span>
        </div>

        {/* Route */}
        {meta && (
          <div className="space-y-1.5 p-2.5 rounded-lg bg-background/50 border border-border">
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-muted-foreground truncate">{meta.pickup?.address ?? "—"}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Navigation2 className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <span className="text-muted-foreground truncate">{meta.dropoff?.address ?? "—"}</span>
            </div>
            {meta.distanceKm && (
              <div className="flex gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border">
                <span>{meta.distanceKm.toFixed(1)} km</span>
                <span>{Math.round(meta.durationMin ?? 0)} min est.</span>
              </div>
            )}
          </div>
        )}

        {/* Service + time */}
        <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0"><Zap className="w-3 h-3 text-amber-400 shrink-0" /><span className="truncate">{serviceName(b.service_id)}</span></span>
          <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />{new Date(b.booking_date).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        {/* Amount + branch */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 font-bold text-emerald-400 text-sm shrink-0"><DollarSign className="w-3.5 h-3.5" />₱{Number(b.amount).toFixed(0)}</span>
          <span className="text-xs text-muted-foreground truncate text-right">{branchName(b.branch_id)}</span>
        </div>

        {/* Status-driven action buttons */}
        {b.status === "pending" && (
          b.driver_id === user?.id ? (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
              <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus(b.id, "rejected")} className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20">
                <X className="w-3.5 h-3.5 mr-1" />Decline
              </Button>
            </div>
          ) : (
            <div className="pt-1 border-t border-border">
              <p className="text-xs text-center text-muted-foreground italic py-1">
                Waiting for admin to assign a driver…
              </p>
            </div>
          )
        )}
        {b.status === "confirmed" && (
          <div className="pt-1 border-t border-border">
            <Button size="sm" onClick={() => updateStatus(b.id, "picked_up")} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white">
              <MapPin className="w-3.5 h-3.5 mr-1" />Mark as Picked Up
            </Button>
          </div>
        )}
        {b.status === "picked_up" && (
          <div className="pt-1 border-t border-border">
            <Button size="sm" onClick={() => updateStatus(b.id, "on_the_way")} className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white">
              <Navigation2 className="w-3.5 h-3.5 mr-1" />Mark On The Way
            </Button>
          </div>
        )}
        {b.status === "on_the_way" && (
          <div className="pt-1 border-t border-border">
            <Button size="sm" onClick={() => updateStatus(b.id, "completed")} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Complete Ride
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <AppShell title="Driver Dashboard" nav={[]}>

      {/* On-duty toggle */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-card border border-border shadow-card">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${onDuty ? "bg-emerald-500/20" : "bg-secondary"}`}>
            <Car className={`w-5 h-5 transition-colors ${onDuty ? "text-emerald-400" : "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="font-semibold text-sm">{onDuty ? "On Duty" : "Off Duty"}</div>
            <div className="text-xs text-muted-foreground">
              {onDuty ? "You are visible and accepting rides" : "Toggle on duty to start accepting rides"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setOnDuty(!onDuty)}
          className={`relative w-12 h-6 rounded-full transition-colors ${onDuty ? "bg-emerald-500" : "bg-secondary border border-border"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${onDuty ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 bg-card border-border shadow-card">
          <div className="text-xs text-muted-foreground mb-1">In Queue</div>
          <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">pending rides</div>
        </Card>
        <Card className="p-4 bg-card border-border shadow-card">
          <div className="text-xs text-muted-foreground mb-1">Active</div>
          <div className="text-2xl font-bold text-cyan-400">{inProgress.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">in progress</div>
        </Card>
        <Card className="p-4 bg-card border-border shadow-card">
          <div className="text-xs text-muted-foreground mb-1">Done Today</div>
          <div className="text-2xl font-bold text-emerald-400">{completedToday.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">₱{earningsToday.toFixed(0)} earned</div>
        </Card>
        <Card className="p-4 bg-card border-border shadow-card">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />This Week
          </div>
          <div className="text-2xl font-bold text-violet-400">₱{earningsWeek.toFixed(0)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">total earnings</div>
        </Card>
      </div>

      {/* Ride tabs */}
      <Tabs defaultValue="queue">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="queue" className="flex-1 gap-1.5">
            Queue
            {pending.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1 gap-1.5">
            Active
            {inProgress.length > 0 && (
              <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-medium">
                {inProgress.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        {/* Queue */}
        <TabsContent value="queue">
          {!onDuty ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Car className="w-8 h-8 opacity-30" />
              <span className="text-sm">You are off duty.</span>
              <span className="text-xs">Toggle the switch above to start accepting rides.</span>
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CheckCircle2 className="w-8 h-8 opacity-30" />
              <span className="text-sm">No rides in queue right now.</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pending.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
        </TabsContent>

        {/* Active */}
        <TabsContent value="active">
          {inProgress.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Car className="w-8 h-8 opacity-30" />
              <span className="text-sm">No active rides right now.</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {inProgress.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {historyBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CheckCircle2 className="w-8 h-8 opacity-30" />
              <span className="text-sm">No history yet.</span>
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto pr-0.5">
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {historyBookings.map((b) => <BookingCard key={b.id} b={b} />)}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

    </AppShell>
  );
}
