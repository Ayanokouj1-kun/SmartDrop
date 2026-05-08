import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Package, Calendar, DollarSign, Pencil, Check, X, Clock, Tag, AlignLeft, PhilippinePeso, User, MapPin, Navigation2, Car, Star, Route, MessageSquare } from "lucide-react";

type TimeVal = { h: string; m: string; p: "AM" | "PM" };
const to24h = (t: TimeVal) => { let h = parseInt(t.h); if (t.p === "PM" && h !== 12) h += 12; if (t.p === "AM" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${t.m}`; };
const parse24h = (time: string | null): TimeVal => { if (!time) return { h: "8", m: "00", p: "AM" }; const [hStr, mStr] = time.split(":"); const h24 = parseInt(hStr); return { h: h24 % 12 === 0 ? "12" : String(h24 % 12), m: mStr || "00", p: h24 >= 12 ? "PM" : "AM" }; };
const fmt12h = (t: string | null) => { if (!t) return "—"; const v = parse24h(t); return `${v.h}:${v.m} ${v.p}`; };

function TimePicker({ value, onChange, label }: { value: TimeVal; onChange: (v: TimeVal) => void; label: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{label}</label>
      <div className="flex items-center gap-1">
        <select value={value.h} onChange={(e) => onChange({ ...value, h: e.target.value })} className="h-9 rounded-md border border-border bg-secondary px-2 text-sm w-14 text-center">
          {["1","2","3","4","5","6","7","8","9","10","11","12"].map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-muted-foreground font-bold">:</span>
        <select value={value.m} onChange={(e) => onChange({ ...value, m: e.target.value })} className="h-9 rounded-md border border-border bg-secondary px-2 text-sm w-16 text-center">
          {["00","15","30","45"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={value.p} onChange={(e) => onChange({ ...value, p: e.target.value as "AM"|"PM" })} className="h-9 rounded-md border border-border bg-secondary px-2 text-sm w-16 font-medium">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

interface Branch { id: string; name: string; location: string | null; }
interface Service { id: string; branch_id: string; name: string; description: string | null; price: number; is_active: boolean; available_from: string | null; available_to: string | null; }
interface Booking { id: string; booking_date: string; status: string; amount: number; service_id: string; branch_id: string; user_id: string; notes: string | null; driver_id: string | null; }
interface Driver  { user_id: string; display_name: string | null; email: string | null; }
interface Profile { user_id: string; display_name: string | null; email: string | null; username: string | null; }

const STATUSES = ["pending", "confirmed", "picked_up", "on_the_way", "completed", "cancelled", "rejected"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pending",
  confirmed:  "Accepted",
  picked_up:  "Picked Up",
  on_the_way: "On The Way",
  completed:  "Completed",
  cancelled:  "Cancelled",
  rejected:   "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "border-amber-500/40 text-amber-400",
  confirmed:  "border-cyan-500/40 text-cyan-400",
  picked_up:  "border-blue-500/40 text-blue-400",
  on_the_way: "border-violet-500/40 text-violet-400",
  completed:  "border-emerald-500/40 text-emerald-400",
  cancelled:  "border-red-500/40 text-red-400",
  rejected:   "border-gray-500/40 text-gray-400",
};

const STATUS_BTN: Record<string, string> = {
  all:        "border-border text-muted-foreground hover:bg-secondary",
  pending:    "border-amber-500/40   text-amber-400   hover:bg-amber-500/10",
  confirmed:  "border-cyan-500/40    text-cyan-400    hover:bg-cyan-500/10",
  picked_up:  "border-blue-500/40    text-blue-400    hover:bg-blue-500/10",
  on_the_way: "border-violet-500/40  text-violet-400  hover:bg-violet-500/10",
  completed: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
  cancelled: "border-red-500/40     text-red-400     hover:bg-red-500/10",
  rejected:  "border-gray-500/40   text-gray-400    hover:bg-gray-500/10",
};

const STATUS_BTN_ACTIVE: Record<string, string> = {
  all:       "bg-secondary  text-foreground  border-border",
  pending:   "bg-amber-500/20   text-amber-300   border-amber-500/50",
  confirmed: "bg-cyan-500/20    text-cyan-300    border-cyan-500/50",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  cancelled: "bg-red-500/20     text-red-300     border-red-500/50",
  rejected:  "bg-gray-500/20   text-gray-300   border-gray-500/50",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newSvc, setNewSvc] = useState({ branch_id: "", name: "", description: "", price: "" });
  const [newFrom, setNewFrom] = useState<TimeVal>({ h: "8", m: "00", p: "AM" });
  const [newTo, setNewTo] = useState<TimeVal>({ h: "5", m: "00", p: "PM" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", price: "" });
  const [editFrom, setEditFrom] = useState<TimeVal>({ h: "8", m: "00", p: "AM" });
  const [editTo, setEditTo] = useState<TimeVal>({ h: "5", m: "00", p: "PM" });
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverSelect, setDriverSelect] = useState<Record<string, string>>({});
  const [busyDriverIds, setBusyDriverIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string | null }>>({});

  useEffect(() => { void load(); }, [user]);

  async function load() {
    if (!user) return;
    const { data: assigned } = await supabase.from("admin_branches").select("branch_id, branches(id,name,location)").eq("admin_id", user.id);
    const branchList = (assigned ?? []).map((a: any) => a.branches).filter(Boolean) as Branch[];
    setBranches(branchList);
    const branchIds = branchList.map((b) => b.id);
    if (branchIds.length === 0) { setServices([]); setBookings([]); return; }
    const [svc, bk, dRoles] = await Promise.all([
      supabase.from("services").select("*").in("branch_id", branchIds).order("name"),
      supabase.from("bookings").select("*").in("branch_id", branchIds).order("booking_date", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("user_roles").select("user_id").eq("role", "driver"),
    ]);
    setServices((svc.data ?? []) as Service[]);
    const bkData = (bk.data ?? []) as unknown as Booking[];
    setBookings(bkData);
    // Track which drivers currently have an active ride
    const activeBk = bkData.filter((b) => ["confirmed", "picked_up", "on_the_way"].includes(b.status) && b.driver_id);
    setBusyDriverIds(new Set(activeBk.map((b) => b.driver_id as string)));
    const uids = [...new Set(bkData.map((b) => b.user_id))];
    if (uids.length > 0) {
      const { data: prof } = await supabase.from("profiles").select("user_id,display_name,email,username").in("user_id", uids);
      setProfiles((prof ?? []) as Profile[]);
    }
    const dIds = ((dRoles.data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (dIds.length > 0) {
      const { data: dProfs } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", dIds);
      setDrivers((dProfs ?? []) as Driver[]);
    } else {
      setDrivers([]);
    }
    // Load ratings for completed bookings
    const completedIds = bkData.filter((b) => b.status === "completed").map((b) => b.id);
    if (completedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rData } = await (supabase as any).from("ratings").select("booking_id, rating, comment").in("booking_id", completedIds);
      if (rData) {
        const map: Record<string, { rating: number; comment: string | null }> = {};
        (rData as { booking_id: string; rating: number; comment: string | null }[]).forEach((r) => { map[r.booking_id] = { rating: r.rating, comment: r.comment }; });
        setRatings(map);
      }
    }
  }

  const driverName = (uid: string) => { const d = drivers.find((d) => d.user_id === uid); return d?.display_name ?? d?.email?.split("@")[0] ?? "Driver"; };
  async function assignDriver(bookingId: string, driverId: string | null, currentStatus: string) {
    // When assigning a driver to a pending booking, confirm it immediately
    const patch: Record<string, unknown> = { driver_id: driverId };
    if (driverId && currentStatus === "pending") patch.status = "confirmed";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("bookings").update(patch).eq("id", bookingId);
    if (error) return toast.error(error.message);
    toast.success(driverId ? "Driver assigned & booking confirmed!" : "Driver removed");
    setDriverSelect((prev) => { const next = { ...prev }; delete next[bookingId]; return next; });
    void load();
  }

  const nameOf = (uid: string) => {
    const p = profiles.find((p) => p.user_id === uid);
    return p?.username ?? p?.display_name ?? p?.email ?? uid.slice(0, 8);
  };
  const parseNotes = (notes: string | null) => { try { return notes ? JSON.parse(notes) : null; } catch { return null; } };

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!newSvc.branch_id || !newSvc.name) return toast.error("Branch and name required");
    const { error } = await supabase.from("services").insert({
      branch_id: newSvc.branch_id, name: newSvc.name,
      description: newSvc.description || null, price: Number(newSvc.price) || 0,
      available_from: to24h(newFrom), available_to: to24h(newTo),
    });
    if (error) return toast.error(error.message);
    toast.success("Service added");
    setNewSvc({ branch_id: "", name: "", description: "", price: "" });
    setNewFrom({ h: "8", m: "00", p: "AM" });
    setNewTo({ h: "5", m: "00", p: "PM" });
    void load();
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEditForm({ name: s.name, description: s.description ?? "", price: String(s.price) });
    setEditFrom(parse24h(s.available_from));
    setEditTo(parse24h(s.available_to));
  }

  async function saveEdit(id: string) {
    const { error } = await supabase.from("services").update({
      name: editForm.name, description: editForm.description || null,
      price: Number(editForm.price) || 0,
      available_from: to24h(editFrom), available_to: to24h(editTo),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Service updated");
    setEditId(null);
    void load();
  }

  async function toggleService(id: string, is_active: boolean) {
    const { error } = await supabase.from("services").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function setStatus(id: string, status: Status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: `booking.${status}`, entity_type: "booking", entity_id: id });
    void load();
  }

  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0);
  const filteredBookings = useMemo(() => statusFilter === "all" ? bookings : bookings.filter((b) => b.status === statusFilter), [bookings, statusFilter]);

  return (
    <AppShell title="Admin Dashboard" nav={[]}>
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: <Building2 className="w-5 h-5 text-amber-400" />, label: "Assigned Branches", value: branches.length },
          { icon: <Package className="w-5 h-5 text-violet-400" />, label: "Services", value: services.length },
          { icon: <Calendar className="w-5 h-5 text-cyan-400" />, label: "Pending Bookings", value: bookings.filter((b) => b.status === "pending").length },
          { icon: <DollarSign className="w-5 h-5 text-emerald-400" />, label: "Revenue (completed)", value: `₱${totalRevenue.toFixed(2)}` },
        ].map((s) => (
          <Card key={s.label} className="p-4 md:p-5 bg-card border-border shadow-card">
            <div className="mb-2">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {branches.length === 0 && (
        <Card className="p-6 bg-card border-border shadow-card text-sm text-muted-foreground">
          You haven't been assigned to any branch yet. Ask a superadmin to assign you.
        </Card>
      )}

      {branches.length > 0 && (
        <Tabs defaultValue="services" className="space-y-4">
          <TabsList className="bg-secondary border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="services" className="gap-1.5"><Package className="w-3.5 h-3.5" />Services</TabsTrigger>
            <TabsTrigger value="feedback" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Feedback</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="w-3.5 h-3.5" />Bookings</TabsTrigger>
            <TabsTrigger value="branches" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />My Branches</TabsTrigger>
          </TabsList>

          {/* ── Services ── */}
          <TabsContent value="services" className="space-y-4">
            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-1">Add Service</h2>
              <p className="text-xs text-muted-foreground mb-5">Define a delivery or ride service available at your branch.</p>
              <form onSubmit={addService} className="space-y-5">

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />Branch</label>
                    <select value={newSvc.branch_id} onChange={(e) => setNewSvc({ ...newSvc, branch_id: e.target.value })}
                      className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                      <option value="">Select branch…</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" />Service Name</label>
                    <Input placeholder="e.g. Regular Ride, Parcel Drop-off, Night Ride..." value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} className="h-9" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><PhilippinePeso className="w-3 h-3" />Price</label>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                    <Input placeholder="0.00" type="number" step="0.01" min="0" value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })} className="h-9 pl-7" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-secondary/50 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Hours</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <TimePicker value={newFrom} onChange={setNewFrom} label="Opens at" />
                    <TimePicker value={newTo} onChange={setNewTo} label="Closes at" />
                  </div>
                  <p className="text-xs text-muted-foreground">Customers can only book during: <span className="font-medium text-foreground">{newFrom.h}:{newFrom.m} {newFrom.p} – {newTo.h}:{newTo.m} {newTo.p}</span></p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlignLeft className="w-3 h-3" />Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea placeholder="" value={newSvc.description} onChange={(e) => setNewSvc({ ...newSvc, description: e.target.value })} rows={3} />
                </div>

                <Button type="submit" className="w-full">Add Service</Button>
              </form>
            </Card>

            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-4">Services <span className="text-sm font-normal text-muted-foreground">({services.length})</span></h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {services.length === 0 && <p className="text-sm text-muted-foreground">No services yet.</p>}
                {services.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-secondary border border-border">
                    {editId === s.id ? (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Name</label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8 text-sm" /></div>
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Price (₱)</label><Input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} type="number" className="h-8 text-sm" /></div>
                        </div>
                        <div className="p-3 rounded-lg border border-border bg-background/40 space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Available Hours</p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <TimePicker value={editFrom} onChange={setEditFrom} label="Opens at" />
                            <TimePicker value={editTo} onChange={setEditTo} label="Closes at" />
                          </div>
                        </div>
                        <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" rows={2} className="text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1" onClick={() => saveEdit(s.id)}><Check className="w-3.5 h-3.5" />Save</Button>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" />Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">· ₱{Number(s.price).toFixed(2)}</span></div>
                          <div className="text-xs text-muted-foreground">
                            {branches.find((b) => b.id === s.branch_id)?.name}
                            {s.available_from && s.available_to ? ` · ${s.available_from}–${s.available_to}` : ""}
                          </div>
                          {s.description && <div className="text-xs text-muted-foreground mt-0.5 italic">{s.description}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => toggleService(s.id, s.is_active)}>
                            <Badge variant="outline" className={s.is_active ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>{s.is_active ? "active" : "inactive"}</Badge>
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => startEdit(s)}><Pencil className="w-3.5 h-3.5" />Edit</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ── Bookings ── */}
          <TabsContent value="bookings">
            <Card className="p-4 sm:p-6 bg-card border-border shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-lg">Bookings <span className="text-sm font-normal text-muted-foreground">({filteredBookings.length})</span></h2>
                <div className="flex flex-wrap gap-1">
                  {([{ v: "all", label: "All" }, ...STATUSES.map((s) => ({ v: s, label: STATUS_LABELS[s] }))] as { v: string; label: string }[]).map(({ v, label }) => (
                    <button key={v} onClick={() => setStatusFilter(v as Status | "all")}
                      className={`h-7 px-3 text-xs font-medium rounded-full border transition-all ${
                        statusFilter === v ? (STATUS_BTN_ACTIVE[v] ?? "bg-secondary text-foreground border-border") : (STATUS_BTN[v] ?? "border-border text-muted-foreground hover:bg-secondary")
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 max-h-[55vh] md:max-h-[600px] overflow-y-auto pr-1">
                {filteredBookings.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No bookings found.</p>}
                {filteredBookings.map((b) => {
                  const svc = services.find((s) => s.id === b.service_id);
                  const meta = parseNotes(b.notes);
                  const rating = ratings[b.id];
                  const distKm = meta?.distanceKm ?? 0;
                  const basefare = 30;
                  const perKm = 8;
                  return (
                    <div key={b.id} className="rounded-xl border border-border bg-secondary overflow-hidden">

                      {/* ── Header ── */}
                      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <span className="font-semibold text-sm">{nameOf(b.user_id)}</span>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-sm text-muted-foreground">{svc?.name ?? "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground pl-8">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {new Date(b.booking_date).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            <span>·</span>
                            <Building2 className="w-3 h-3 shrink-0" />
                            {branches.find((br) => br.id === b.branch_id)?.name ?? "—"}
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[b.status] ?? ""}`}>
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </div>

                      {/* ── Route + Fare ── */}
                      {meta && (
                        <div className="mx-4 mb-3 rounded-lg bg-background/60 border border-border p-3 space-y-2">
                          <div className="flex items-start gap-2 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            <div><span className="text-muted-foreground font-medium">Pickup: </span><span className="text-foreground">{meta.pickup?.address ?? "—"}</span></div>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <Navigation2 className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                            <div><span className="text-muted-foreground font-medium">Dropoff: </span><span className="text-foreground">{meta.dropoff?.address ?? "—"}</span></div>
                          </div>
                          {distKm > 0 && (
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Route className="w-3 h-3 text-violet-400" />{distKm.toFixed(1)} km</span>
                                <span>·</span>
                                <span>{Math.round(meta.durationMin ?? 0)} min est.</span>
                              </div>
                              <div className="text-xs text-right">
                                <span className="text-muted-foreground">₱{basefare} base + ₱{perKm}×{distKm.toFixed(1)}km</span>
                                <span className="ml-2 font-bold text-emerald-400 text-sm">= ₱{Number(b.amount).toFixed(0)}</span>
                              </div>
                            </div>
                          )}
                          {distKm === 0 && (
                            <div className="flex justify-end pt-1">
                              <span className="font-bold text-emerald-400 text-sm">₱{Number(b.amount).toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Driver assignment ── */}
                      <div className="px-4 pb-3">
                        {b.driver_id ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <Car className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            <span className="text-xs text-muted-foreground">Assigned driver:</span>
                            <span className="text-xs font-semibold text-violet-300 flex-1">{driverName(b.driver_id)}</span>
                            {busyDriverIds.has(b.driver_id) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">On a ride</span>
                            )}
                            {!["completed","cancelled","rejected"].includes(b.status) && (
                              <button onClick={() => void assignDriver(b.id, null, b.status)} className="text-red-400 hover:text-red-300 ml-1" title="Remove driver">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {drivers.length > 0 ? (
                              <>
                                <select value={driverSelect[b.id] ?? ""} onChange={(e) => setDriverSelect((p) => ({ ...p, [b.id]: e.target.value }))}
                                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs">
                                  <option value="">Select available driver…</option>
                                  {drivers.map((d) => {
                                    const busy = busyDriverIds.has(d.user_id);
                                    return <option key={d.user_id} value={d.user_id} disabled={busy}>{busy ? "🔴 " : "🟢 "}{driverName(d.user_id)}{busy ? " (on a ride)" : " (available)"}</option>;
                                  })}
                                </select>
                                <button disabled={!driverSelect[b.id]} onClick={() => { const id = driverSelect[b.id]; if (id) void assignDriver(b.id, id, b.status); }}
                                  className="h-8 px-3 text-xs rounded-md border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
                                  Assign
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No drivers in your branches</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Status override buttons ── */}
                      {!["completed","cancelled","rejected"].includes(b.status) && (
                        <div className="px-4 pb-3">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Override status</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(["confirmed", "cancelled", "rejected"] as Status[]).map((s) => (
                              <button key={s} disabled={b.status === s} onClick={() => setStatus(b.id, s)}
                                className={`h-7 px-2.5 text-xs font-medium rounded-full border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                                  b.status === s ? (STATUS_BTN_ACTIVE[s] ?? "") : STATUS_BTN[s]
                                }`}>{STATUS_LABELS[s]}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Rating (completed rides) ── */}
                      {rating && (
                        <div className="px-4 pb-4 border-t border-border pt-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map((i) => (
                                <Star key={i} className={`w-3.5 h-3.5 ${i <= rating.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-amber-400">{rating.rating}/5</span>
                            {rating.comment && <span className="text-xs text-muted-foreground italic">"{rating.comment}"</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* ── Driver Feedback ── */}
          <TabsContent value="feedback">
            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-1">Driver Feedback</h2>
              <p className="text-xs text-muted-foreground mb-5">Ratings and comments left by customers for completed rides in your branches.</p>
              {Object.keys(ratings).length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet — ratings appear here once customers rate completed rides.</p>
              ) : (() => {
                // Build per-driver summary
                const driverMap: Record<string, { name: string; ratings: { stars: number; comment: string | null; customer: string; date: string }[] }> = {};
                bookings.filter((b) => b.status === "completed" && ratings[b.id] && b.driver_id).forEach((b) => {
                  const r = ratings[b.id];
                  const did = b.driver_id!;
                  if (!driverMap[did]) driverMap[did] = { name: driverName(did), ratings: [] };
                  driverMap[did].ratings.push({ stars: r.rating, comment: r.comment, customer: nameOf(b.user_id), date: b.booking_date });
                });
                return (
                  <div className="space-y-5">
                    {Object.entries(driverMap).map(([did, info]) => {
                      const avg = info.ratings.reduce((s, r) => s + r.stars, 0) / info.ratings.length;
                      return (
                        <div key={did} className="rounded-xl border border-border bg-secondary overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-violet-500/5">
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                              <Car className="w-4 h-4 text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm">{info.name}</div>
                              <div className="text-xs text-muted-foreground">{info.ratings.length} review{info.ratings.length !== 1 ? "s" : ""}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex items-center gap-0.5">
                                {[1,2,3,4,5].map((i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(avg) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                                ))}
                              </div>
                              <span className="text-sm font-bold text-amber-400">{avg.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
                            {info.ratings.map((r, i) => (
                              <div key={i} className="px-4 py-3 flex items-start gap-3">
                                <div className="flex items-center gap-0.5 mt-0.5 shrink-0">
                                  {[1,2,3,4,5].map((j) => (
                                    <Star key={j} className={`w-3 h-3 ${j <= r.stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                                  ))}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{r.customer}</span>
                                    <span className="text-[10px] text-muted-foreground">{new Date(r.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                                  </div>
                                  {r.comment ? (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">"{r.comment}"</p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground/50 italic mt-0.5">No comment</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>
          </TabsContent>

          {/* ── My Branches ── */}
          <TabsContent value="branches">
            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-4">My Assigned Branches</h2>
              <div className="space-y-3">
                {branches.map((b) => {
                  const bServices = services.filter((s) => s.branch_id === b.id);
                  const bBookings = bookings.filter((bk) => bk.branch_id === b.id);
                  const bRevenue = bBookings.filter((bk) => bk.status === "completed").reduce((s, bk) => s + Number(bk.amount), 0);
                  return (
                    <div key={b.id} className="p-4 rounded-lg bg-secondary border border-border">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="font-medium">{b.name}</div>
                          {b.location && <div className="text-xs text-muted-foreground">{b.location}</div>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 rounded-lg bg-background/50">
                          <div className="text-lg font-bold text-violet-400">{bServices.length}</div>
                          <div className="text-xs text-muted-foreground">Services</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-background/50">
                          <div className="text-lg font-bold text-cyan-400">{bBookings.length}</div>
                          <div className="text-xs text-muted-foreground">Bookings</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-background/50">
                          <div className="text-lg font-bold text-emerald-400">₱{bRevenue.toFixed(0)}</div>
                          <div className="text-xs text-muted-foreground">Revenue</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
