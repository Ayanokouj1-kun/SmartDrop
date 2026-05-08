import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import BookingMap, { RouteInfo } from "@/components/BookingMap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, MapPin, Navigation2, X, Clock, DollarSign, CheckCircle2, Circle, Zap, User, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Service { id: string; name: string; price: number; branch_id: string; description: string | null; available_from: string | null; available_to: string | null; }
interface Branch { id: string; name: string; location: string | null; }
interface Booking { id: string; booking_date: string; status: string; amount: number; service_id: string; branch_id: string; notes: string | null; driver_id: string | null; }

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

const RIDE_STEPS = [
  { key: "pending",    label: "Submitted"  },
  { key: "confirmed",  label: "Accepted"   },
  { key: "picked_up",  label: "Picked Up"  },
  { key: "on_the_way", label: "On The Way" },
  { key: "completed",  label: "Completed"  },
];

function getStepIdx(status: string) {
  const map: Record<string, number> = { pending: 0, confirmed: 1, picked_up: 2, on_the_way: 3, completed: 4 };
  return map[status] ?? 0;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [driverProfile, setDriverProfile] = useState<{ display_name: string | null; email: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());

  useEffect(() => { void load(); }, [user]);

  // ── Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bookings-live-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "bookings",
        filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.eventType === "UPDATE") {
          const s = (payload.new as Booking).status;
          const msg: Record<string, string> = {
            confirmed: "✅ Your booking has been confirmed!",
            completed: "🎉 Ride completed. Thanks for riding SmartDrop!",
            rejected:  "❌ Your booking was declined.",
          };
          if (msg[s]) toast(msg[s]);
        }
        const { data } = await supabase.from("bookings").select("*").eq("user_id", user.id).order("booking_date", { ascending: false });
        setBookings((data ?? []) as unknown as Booking[]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  async function load() {
    const [svc, br, bk] = await Promise.all([
      supabase.from("services").select("*").eq("is_active", true),
      supabase.from("branches").select("*").eq("is_active", true),
      user ? supabase.from("bookings").select("*").eq("user_id", user.id).order("booking_date", { ascending: false }) : Promise.resolve({ data: [] as Booking[] }),
    ]);
    setServices((svc.data ?? []) as Service[]);
    setBranches((br.data ?? []) as Branch[]);
    setBookings((bk.data ?? []) as Booking[]);
    // Load already-submitted ratings so the Rate Driver button stays hidden after refresh
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rData } = await (supabase as any).from("ratings").select("booking_id").eq("user_id", user.id);
      if (rData) setRatedIds(new Set((rData as { booking_id: string }[]).map((r) => r.booking_id)));
    }
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!serviceId || !date) { toast.error("Pick a service and schedule"); return; }
    if (!route?.pickup || !route?.dropoff) { toast.error("Set pickup and dropoff on the map"); return; }
    setSubmitting(true);
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) { setSubmitting(false); return; }
    const notes = JSON.stringify({
      pickup: { coords: route.pickup, address: route.pickupAddress },
      dropoff: { coords: route.dropoff, address: route.dropoffAddress },
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
    });
    const amount = Math.round(svc.price + route.distanceKm * 8);
    const { error } = await supabase.from("bookings").insert({
      user_id: user.id, service_id: svc.id, branch_id: svc.branch_id,
      booking_date: new Date(date).toISOString(),
      amount,
      notes,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("Booking submitted!");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setServiceId(""); setRoute(null);
    setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setSubmitting(false);
    void load();
  }

  async function cancel(id: string) {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled");
    void load();
  }

  async function submitRating(bookingId: string, driverId: string | null, stars: number) {
    if (!user || !driverId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("ratings").insert({ booking_id: bookingId, user_id: user.id, driver_id: driverId, rating: stars, comment: ratingComment });
    if (error) return toast.error(error.message);
    toast.success(`Rated ${stars} ★ — Thank you!`);
    setRatedIds((prev) => new Set(prev).add(bookingId));
    setRatingBookingId(null); setRatingValue(0); setRatingComment("");
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Service";

  const parseNotes = (notes: string | null) => {
    try { return notes ? JSON.parse(notes) : null; } catch { return null; }
  };

  const selectedSvc = services.find((s) => s.id === serviceId);
  const activeBooking = useMemo(() => bookings.find((b) => ["pending","confirmed","picked_up","on_the_way"].includes(b.status)), [bookings]);
  const activeMeta = useMemo(() => parseNotes(activeBooking?.notes ?? null), [activeBooking]);
  const activeStep = activeBooking ? getStepIdx(activeBooking.status) : -1;

  useEffect(() => {
    if (!activeBooking?.driver_id) { setDriverProfile(null); return; }
    void supabase.from("profiles").select("display_name, email").eq("user_id", activeBooking.driver_id).single()
      .then(({ data }) => setDriverProfile(data as { display_name: string | null; email: string | null } | null));
  }, [activeBooking?.driver_id]);

  return (
    <AppShell title="Book a Ride" nav={[]}>
      <div className="grid lg:grid-cols-[1fr_380px] gap-4 md:gap-6 items-start">

        {/* ── Map + booking form ── */}
        <Card className="p-4 sm:p-6 bg-card border-border shadow-card space-y-4 sm:space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Where to?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pin your pickup and dropoff on the map, or search an address.</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
            <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Book your ride — a nearby driver will accept and head to your pickup. No need to choose a driver.</span>
          </div>
          <BookingMap onUpdate={setRoute} baseFare={selectedSvc?.price} />

          {/* Booking details */}
          <form onSubmit={handleBook} className="space-y-4 border-t border-border pt-4">
            <h3 className="font-medium text-sm">Booking details</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Service type</label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Choose service…" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · ₱{Number(s.price).toFixed(0)} base · {branchName(s.branch_id)}
                      </SelectItem>
                    ))}
                    {services.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No services available</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Schedule</label>
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border h-9 text-sm" />
              </div>
            </div>

            {selectedSvc?.description && (
              <p className="text-xs text-muted-foreground italic border border-border rounded-lg px-3 py-2">{selectedSvc.description}</p>
            )}

            {/* Fare summary */}
            {route?.pickup && route?.dropoff && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-secondary border border-border text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs"><div className="text-muted-foreground">Pickup</div><div className="font-medium truncate max-w-[150px]">{route.pickupAddress}</div></div>
                </div>
                <div className="flex items-start gap-2">
                  <Navigation2 className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <div className="text-xs"><div className="text-muted-foreground">Dropoff</div><div className="font-medium truncate max-w-[150px]">{route.dropoffAddress}</div></div>
                </div>
                <div className="flex items-center gap-2 col-span-2 border-t border-border pt-2 mt-1 justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{Math.round(route.durationMin)} min · {route.distanceKm.toFixed(1)} km</span>
                  <span className="flex items-center gap-1 text-sm font-bold text-emerald-400"><DollarSign className="w-3.5 h-3.5" />₱{selectedSvc ? Math.round(selectedSvc.price + route.distanceKm * 8) : route.fare} est.</span>
                </div>
              </div>
            )}

            <Button type="submit" disabled={submitting || !route?.pickup || !route?.dropoff || !serviceId || !date}
              className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-10">
              <Calendar className="w-4 h-4 mr-2" />{submitting ? "Submitting…" : "Confirm Booking"}
            </Button>
          </form>
        </Card>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Active ride card */}
          {activeBooking && (
            <Card className="p-5 bg-card border-l-4 border-l-violet-500 border-t border-r border-b border-border shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                  </span>
                  Active Ride
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[activeBooking.status] ?? ""}`}>{STATUS_LABELS[activeBooking.status] ?? activeBooking.status}</span>
              </div>

              {/* Progress steps */}
              <div className="flex items-start mb-4">
                {RIDE_STEPS.map((step, i) => {
                  const done = i < activeStep;
                  const current = i === activeStep;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${done ? "bg-emerald-500" : current ? "bg-violet-500 ring-2 ring-violet-500/30" : "bg-secondary border border-border"}`}>
                          {done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : current ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${done ? "text-emerald-400" : current ? "text-violet-400" : "text-muted-foreground"}`}>{step.label}</span>
                      </div>
                      {i < RIDE_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${done ? "bg-emerald-500/60" : "bg-border"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Route */}
              {activeMeta && (
                <div className="space-y-1.5 mb-3 p-2.5 rounded-lg bg-secondary border border-border">
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground truncate">{activeMeta.pickup?.address ?? "—"}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Navigation2 className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground truncate">{activeMeta.dropoff?.address ?? "—"}</span>
                  </div>
                  {activeMeta.distanceKm && (
                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-border flex gap-3">
                      <span>{activeMeta.distanceKm.toFixed(1)} km</span>
                      <span>{Math.round(activeMeta.durationMin ?? 0)} min est.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3">
                <span className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3 text-amber-400" />{serviceName(activeBooking.service_id)}</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400 justify-end"><DollarSign className="w-3 h-3" />₱{Number(activeBooking.amount).toFixed(0)}</span>
                <span className="flex items-center gap-1 text-muted-foreground col-span-2 text-[11px]"><Calendar className="w-3 h-3" />{new Date(activeBooking.booking_date).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              {/* Assigned driver */}
              {driverProfile && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-2">
                  <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-violet-400" />
                  </div>
                  <div className="text-xs">
                    <div className="text-[10px] text-muted-foreground">Your Driver</div>
                    <div className="font-medium text-violet-300">{driverProfile.display_name ?? driverProfile.email?.split("@")[0] ?? "Driver"}</div>
                  </div>
                </div>
              )}

              {activeBooking.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => cancel(activeBooking.id)}
                  className="w-full h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20">
                  <X className="w-3 h-3 mr-1" />Cancel booking
                </Button>
              )}
            </Card>
          )}

          {/* Booking history */}
          <Card className="p-6 bg-card border-border shadow-card">
            <h2 className="font-semibold text-lg mb-4">My Bookings <span className="text-sm font-normal text-muted-foreground">({bookings.length})</span></h2>
            <div className="space-y-3 max-h-[55vh] lg:max-h-[680px] overflow-y-auto">
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
            {bookings.map((b) => {
              const meta = parseNotes(b.notes);
              return (
                <div key={b.id} className="p-3 rounded-lg bg-secondary border border-border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{serviceName(b.service_id)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[b.status] ?? ""}`}>{STATUS_LABELS[b.status] ?? b.status}</span>
                  </div>
                  {meta && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="truncate">{meta.pickup?.address ?? "—"}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Navigation2 className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                        <span className="truncate">{meta.dropoff?.address ?? "—"}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{branchName(b.branch_id)} · {new Date(b.booking_date).toLocaleString()}</span>
                    <span className="font-semibold text-emerald-400">₱{Number(b.amount).toFixed(0)}</span>
                  </div>
                  {meta && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{meta.distanceKm?.toFixed(1)} km</span>
                      <span>{Math.round(meta.durationMin ?? 0)} min est.</span>
                    </div>
                  )}
                  {b.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(b.id)} className="w-full h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20">
                      <X className="w-3 h-3 mr-1" />Cancel booking
                    </Button>
                  )}
                  {b.status === "completed" && !ratedIds.has(b.id) && (
                    ratingBookingId === b.id ? (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex gap-1 justify-center">
                          {[1,2,3,4,5].map((star) => (
                            <button type="button" key={star} onClick={() => setRatingValue(star)}
                              className={`text-xl transition-colors ${star <= ratingValue ? "text-amber-400" : "text-muted-foreground/30"}`}>
                              <Star className="w-5 h-5 fill-current" />
                            </button>
                          ))}
                        </div>
                        <input placeholder="Comment (optional)" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                          className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs" />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={ratingValue === 0} onClick={() => void submitRating(b.id, b.driver_id, ratingValue)} className="flex-1 h-7 text-xs">Submit</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRatingBookingId(null)} className="h-7 text-xs">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRatingBookingId(b.id)} className="w-full h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20">
                        <Star className="w-3 h-3 mr-1" />Rate Driver
                      </Button>
                    )
                  )}
                </div>
              );
            })}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
