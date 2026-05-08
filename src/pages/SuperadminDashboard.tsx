import { useEffect, useState, useMemo } from "react";
import { format, subDays, parseISO, isAfter } from "date-fns";
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
import {
  Trash2, TrendingUp, TrendingDown, Users, Building2,
  Brain, Lock, Shield, DollarSign, Calendar,
  CheckCircle2, AlertTriangle, Info, BarChart3,
  MapPin, Navigation2, Route, Search, X, Car, User, Settings,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type AppRole = "superadmin" | "admin" | "driver" | "user";
interface Profile { id: string; user_id: string; display_name: string | null; email: string | null; username: string | null; is_active: boolean; }
interface RoleRow { user_id: string; role: AppRole; }
interface Branch { id: string; name: string; location: string | null; description: string | null; is_active: boolean; }
interface Booking { id: string; booking_date: string; status: string; amount: number; user_id: string; branch_id: string; service_id: string; notes: string | null; driver_id: string | null; }
interface Service { id: string; name: string; branch_id: string; }
interface Audit { id: string; actor_id: string | null; action: string; entity_type: string; created_at: string; }
interface Assignment { id: string; admin_id: string; branch_id: string; }

const PIE_COLORS = ["#f59e0b", "#06b6d4", "#10b981", "#ef4444", "#6b7280"];

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function SuperadminDashboard() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [logs, setLogs] = useState<Audit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newBranch, setNewBranch] = useState({ name: "", location: "", description: "" });
  const [assignForm, setAssignForm] = useState({ admin_id: "", branch_id: "" });
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Users & Roles filters
  const [userSearch,     setUserSearch]     = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | AppRole>("all");
  const [userStatus,     setUserStatus]     = useState<"all" | "active" | "deactivated">("all");

  useEffect(() => { void load(); void loadSettings(); }, []);

  const parseNotes = (notes: string | null) => { try { return notes ? JSON.parse(notes) : null; } catch { return null; } };
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "—";

  async function load() {
    const [p, r, b, bk, l, a, sv] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("branches").select("*"),
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }).limit(500),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_branches").select("*"),
      supabase.from("services").select("id, name, branch_id"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoles((r.data ?? []) as RoleRow[]);
    setBranches((b.data ?? []) as Branch[]);
    setBookings((bk.data ?? []) as Booking[]);
    setLogs((l.data ?? []) as Audit[]);
    setAssignments((a.data ?? []) as Assignment[]);
    setServices((sv.data ?? []) as Service[]);
  }

  const rolesOf = (uid: string): AppRole[] => roles.filter((r) => r.user_id === uid).map((r) => r.role);
  const isSuperadmin = (uid: string) => rolesOf(uid).includes("superadmin");
  const nameOf = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name ?? profiles.find((p) => p.user_id === uid)?.email ?? uid.slice(0, 8);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const adminProfiles = profiles.filter((p) => rolesOf(p.user_id).includes("admin"));

  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => a.name.localeCompare(b.name)),
    [branches]
  );

  const filteredProfiles = useMemo(() => {
    const q = userSearch.toLowerCase();
    return profiles.filter((p) => {
      if (q) {
        const haystack = [
          p.display_name ?? "", p.email ?? "", p.username ?? "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (userRoleFilter !== "all") {
        // Inline role lookup so `roles` (already in deps) is the only dependency needed
        const hasRole = roles.some((r) => r.user_id === p.user_id && r.role === userRoleFilter);
        if (!hasRole) return false;
      }
      if (userStatus === "active"      && !p.is_active) return false;
      if (userStatus === "deactivated" &&  p.is_active) return false;
      return true;
    });
  }, [profiles, roles, userSearch, userRoleFilter, userStatus]);

  async function setRole(uid: string, role: AppRole, enable: boolean) {
    if (isSuperadmin(uid)) return toast.error("Superadmin role cannot be modified.");
    if (rolesOf(uid).includes("driver")) return toast.error("Driver accounts have a fixed role and cannot be changed.");
    if (enable) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) return toast.error(error.message);
    }
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: enable ? `role.grant.${role}` : `role.revoke.${role}`, entity_type: "user", entity_id: uid });
    void load();
  }

  async function toggleActive(p: Profile) {
    if (isSuperadmin(p.user_id)) return toast.error("Cannot deactivate a superadmin.");
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function addBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranch.name) return toast.error("Branch name required");
    const { error } = await supabase.from("branches").insert(newBranch);
    if (error) return toast.error(error.message);
    setNewBranch({ name: "", location: "", description: "" });
    void load();
  }

  async function toggleBranch(b: Branch) {
    const { error } = await supabase.from("branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm.admin_id || !assignForm.branch_id) return toast.error("Pick admin and branch");
    const { error } = await supabase.from("admin_branches").insert(assignForm);
    if (error) return toast.error(error.message);
    setAssignForm({ admin_id: "", branch_id: "" });
    void load();
  }

  async function removeAssignment(id: string) {
    const { error } = await supabase.from("admin_branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function loadSettings() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("platform_settings").select("key, value");
    if (data) {
      const map: Record<string, string> = {};
      (data as { key: string; value: string }[]).forEach((r) => { map[r.key] = r.value; });
      setPlatformSettings(map);
    }
  }

  async function saveSetting(key: string, value: string) {
    setSavingSettings(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    setPlatformSettings((prev) => ({ ...prev, [key]: value }));
    toast.success("Setting saved");
  }

  async function overrideBooking(id: string, status: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: `booking.override.${status}`, entity_type: "booking", entity_id: id });
    void load();
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  // Memoized so all downstream useMemos can include it in their dep arrays safely
  const now = useMemo(() => new Date(), []);
  const driverCount = useMemo(() => roles.filter((r) => r.role === "driver").length, [roles]);
  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0);

  const last7Rev = useMemo(() => bookings.filter((b) => { try { return b.status === "completed" && isAfter(parseISO(b.booking_date), subDays(now, 7)); } catch { return false; } }).reduce((s, b) => s + Number(b.amount), 0), [bookings, now]);
  const prev7Rev = useMemo(() => bookings.filter((b) => { try { const d = parseISO(b.booking_date); return b.status === "completed" && isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7)); } catch { return false; } }).reduce((s, b) => s + Number(b.amount), 0), [bookings, now]);
  const revTrend = prev7Rev > 0 ? Math.round(((last7Rev - prev7Rev) / prev7Rev) * 100) : null;

  const last7Bk = useMemo(() => bookings.filter((b) => { try { return isAfter(parseISO(b.booking_date), subDays(now, 7)); } catch { return false; } }).length, [bookings, now]);
  const prev7Bk = useMemo(() => bookings.filter((b) => { try { const d = parseISO(b.booking_date); return isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7)); } catch { return false; } }).length, [bookings, now]);
  const bkTrend = prev7Bk > 0 ? Math.round(((last7Bk - prev7Bk) / prev7Bk) * 100) : null;

  const bookingTrend = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = subDays(now, 29 - i);
    const key = format(d, "MMM d");
    const dayBk = bookings.filter((b) => { try { return format(parseISO(b.booking_date), "MMM d") === key; } catch { return false; } });
    return { date: key, bookings: dayBk.length, revenue: dayBk.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0) };
  }), [bookings, now]);

  const revByBranch = useMemo(() => branches.map((br) => ({
    name: br.name.replace(/ Branch$/i, ""), // strip suffix — displayed in list, not a chart axis
    revenue: bookings.filter((b) => b.branch_id === br.id && b.status === "completed").reduce((s, b) => s + Number(b.amount), 0),
    total: bookings.filter((b) => b.branch_id === br.id).length,
  })), [branches, bookings]);

  const statusDist = useMemo(() => (["pending", "confirmed", "completed", "cancelled", "rejected"] as const)
    .map((s) => ({ name: s, value: bookings.filter((b) => b.status === s).length }))
    .filter((s) => s.value > 0), [bookings]);

  const aiInsights = useMemo(() => {
    const insights: { type: "success" | "warning" | "danger" | "info"; icon: React.ReactNode; text: string }[] = [];
    const completionRate = bookings.length > 0 ? Math.round((bookings.filter((b) => b.status === "completed").length / bookings.length) * 100) : 0;
    insights.push({ type: completionRate > 70 ? "success" : completionRate > 40 ? "warning" : "danger", icon: <CheckCircle2 className="w-4 h-4" />, text: `Completion rate is ${completionRate}%${completionRate > 70 ? " — excellent!" : completionRate > 40 ? " — room to improve." : " — needs attention."}` });
    if (revTrend !== null) insights.push({ type: revTrend >= 0 ? "success" : "warning", icon: revTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />, text: `Revenue ${revTrend >= 0 ? "up" : "down"} ${Math.abs(revTrend)}% this week vs last week.` });
    const topBranch = [...revByBranch].sort((a, b) => b.revenue - a.revenue)[0];
    if (topBranch?.revenue > 0) insights.push({ type: "info", icon: <Building2 className="w-4 h-4" />, text: `Top branch: ${topBranch.name} — ₱${topBranch.revenue.toFixed(2)} revenue.` });
    const pending = bookings.filter((b) => b.status === "pending").length;
    if (pending > 0) insights.push({ type: pending > 5 ? "warning" : "info", icon: <AlertTriangle className="w-4 h-4" />, text: `${pending} booking${pending > 1 ? "s" : ""} still pending${pending > 5 ? " — consider more admins." : "."}` });
    const activeRate = profiles.length > 0 ? Math.round((profiles.filter((p) => p.is_active).length / profiles.length) * 100) : 0;
    insights.push({ type: activeRate > 80 ? "success" : "info", icon: <Users className="w-4 h-4" />, text: `${activeRate}% of users are active (${profiles.filter((p) => p.is_active).length}/${profiles.length}).` });
    const dCount = roles.filter((r) => r.role === "driver").length;
    if (dCount === 0) {
      insights.push({ type: "warning" as const, icon: <Car className="w-4 h-4" />, text: "No drivers assigned yet. Create driver accounts and assign the driver role to handle bookings." });
    } else if (pending > dCount * 3) {
      insights.push({ type: "warning" as const, icon: <Car className="w-4 h-4" />, text: `${dCount} driver${dCount > 1 ? "s" : ""} vs ${pending} pending booking${pending > 1 ? "s" : ""} — high demand, consider adding more drivers.` });
    } else {
      insights.push({ type: "success" as const, icon: <Car className="w-4 h-4" />, text: `${dCount} driver${dCount > 1 ? "s" : ""} available. ${pending} ride${pending !== 1 ? "s" : ""} pending in queue.` });
    }
    const bkWithDist = bookings.filter((b) => { try { return b.notes ? JSON.parse(b.notes) : null; } catch { return false; } });
    if (bkWithDist.length > 0) {
      const avgDist = bkWithDist.reduce((s, b) => { try { return s + (JSON.parse(b.notes!).distanceKm ?? 0); } catch { return s; } }, 0) / bkWithDist.length;
      insights.push({ type: "info", icon: <Route className="w-4 h-4" />, text: `Avg. ride distance: ${avgDist.toFixed(1)} km across ${bkWithDist.length} map-tracked booking${bkWithDist.length > 1 ? "s" : ""}.` });
    }
    if (bookings.length === 0) return [{ type: "info" as const, icon: <Info className="w-4 h-4" />, text: "No booking data yet. Insights will appear as bookings come in." }];
    return insights;
  }, [bookings, revByBranch, profiles, revTrend, roles]);

  const insightColors: Record<string, string> = { success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", warning: "border-amber-500/30 bg-amber-500/10 text-amber-400", danger: "border-red-500/30 bg-red-500/10 text-red-400", info: "border-blue-500/30 bg-blue-500/10 text-blue-400" };

  return (
    <AppShell title="Superadmin Console" nav={[]}>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { icon: <Calendar className="w-5 h-5 text-violet-400" />, label: "Total Bookings", value: bookings.length, trend: bkTrend },
          { icon: <DollarSign className="w-5 h-5 text-emerald-400" />, label: "Revenue (completed)", value: `₱${totalRevenue.toFixed(2)}`, trend: revTrend },
          { icon: <Users className="w-5 h-5 text-cyan-400" />, label: "Active Users", value: profiles.filter((p) => p.is_active).length, trend: null },
          { icon: <Car className="w-5 h-5 text-violet-400" />, label: "Drivers", value: driverCount, trend: null },
          { icon: <Building2 className="w-5 h-5 text-amber-400" />, label: "Branches", value: branches.length, trend: null },
        ].map((s) => (
          <Card key={s.label} className="p-5 bg-card border-border shadow-card">
            <div className="flex items-center justify-between mb-2">{s.icon}<TrendBadge pct={s.trend} /></div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* ── Tabbed sections ── */}
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="bg-secondary border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="analytics" className="gap-1.5"><Brain className="w-3.5 h-3.5" />AI Analytics</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-3.5 h-3.5" />Users & Roles</TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />Branches</TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="w-3.5 h-3.5" />Bookings</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Audit Logs</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="w-3.5 h-3.5" />Settings</TabsTrigger>
        </TabsList>

        {/* ── AI Analytics ── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {aiInsights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${insightColors[ins.type]}`}>
                <span className="mt-0.5 shrink-0">{ins.icon}</span>
                <p className="text-sm leading-snug">{ins.text}</p>
              </div>
            ))}
          </div>

          <Card className="p-6 bg-card border-border shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-400" />Booking & Revenue Trend</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" />Bookings</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />Revenue (₱)</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bookingTrend} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gbk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="grev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                <YAxis yAxisId="bk" orientation="left" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${v}`} width={44} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => name === "Revenue (₱)" ? [`₱${v.toFixed(2)}`, name] : [v, name]} />
                <Area yAxisId="bk" type="monotone" dataKey="bookings" stroke="#8b5cf6" fill="url(#gbk)" strokeWidth={2} name="Bookings" dot={false} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#grev)" strokeWidth={2} name="Revenue (₱)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-right">Last 30 days ending {format(now, "MMM d, yyyy")}</p>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-6 bg-card border-border shadow-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" />Revenue by Branch</h3>
              {revByBranch.every((b) => b.revenue === 0) ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No revenue data yet</div>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {(() => {
                    const sorted = [...revByBranch].sort((a, b) => b.revenue - a.revenue).filter((b) => b.revenue > 0);
                    const max = sorted[0]?.revenue ?? 1;
                    return sorted.map((b, i) => (
                      <div key={b.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">#{i + 1}</span>
                            <span className="font-medium truncate">{b.name}</span>
                            <span className="text-muted-foreground shrink-0">{b.total} bk</span>
                          </span>
                          <span className="text-amber-400 font-semibold shrink-0">₱{b.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(b.revenue / max) * 100}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>

            <Card className="p-6 bg-card border-border shadow-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Booking Status Distribution</h3>
              {statusDist.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {statusDist.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{s.name} ({s.value})
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Users & Roles ── */}
        <TabsContent value="users">
          <Card className="p-6 bg-card border-border shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-lg">
                Users & Roles
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredProfiles.length}/{profiles.length})</span>
              </h2>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search name / email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-8 w-44 bg-secondary border-border text-xs"
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Role filter */}
                <div className="flex items-center rounded-md border border-border overflow-hidden text-xs h-8">
                  {(["all", "superadmin", "admin", "driver", "user"] as const).map((v) => (
                    <button key={v}
                      onClick={() => setUserRoleFilter(v)}
                      className={`px-2.5 h-full transition-colors ${
                        userRoleFilter === v
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}>
                      {v === "all" ? "All roles" : v}
                    </button>
                  ))}
                </div>
                {/* Status filter */}
                <div className="flex items-center rounded-md border border-border overflow-hidden text-xs h-8">
                  {(["all", "active", "deactivated"] as const).map((v) => (
                    <button key={v}
                      onClick={() => setUserStatus(v)}
                      className={`px-2.5 h-full transition-colors ${
                        userStatus === v
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}>
                      {v === "all" ? "All status" : v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {filteredProfiles.map((p) => {
                const r = rolesOf(p.user_id);
                const isDriverRow = r.includes("driver");
                const locked = isSuperadmin(p.user_id) || isDriverRow;
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-secondary border border-border">
                    <div className="flex items-center gap-2">
                      {isSuperadmin(p.user_id) && <Shield className="w-4 h-4 text-violet-400 shrink-0" title="Superadmin — locked" />}
                      {isDriverRow && <Car className="w-4 h-4 text-violet-400 shrink-0" title="Driver — locked" />}
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {p.display_name || p.email}
                          {isSuperadmin(p.user_id) && <Badge className="text-[10px] py-0 px-1.5 bg-violet-500/20 text-violet-300 border-violet-500/30">superadmin</Badge>}
                          {isDriverRow && <Badge className="text-[10px] py-0 px-1.5 bg-violet-500/20 text-violet-300 border-violet-500/30">driver</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}{p.username ? ` · @${p.username}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {locked ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="w-3.5 h-3.5" />{isDriverRow ? "Driver — role fixed" : "Role locked"}
                        </span>
                      ) : (
                        (["user", "admin"] as AppRole[]).map((role) => (
                          <Button key={role} size="sm" variant={r.includes(role) ? "default" : "outline"} onClick={() => setRole(p.user_id, role, !r.includes(role))}>
                            {role}
                          </Button>
                        ))
                      )}
                      <Button size="sm" variant="ghost" disabled={isSuperadmin(p.user_id)} onClick={() => toggleActive(p)}>
                        <Badge variant="outline" className={p.is_active ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>{p.is_active ? "active" : "deactivated"}</Badge>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredProfiles.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {profiles.length === 0 ? "No users yet." : "No users match the current filters."}
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Branches ── */}
        <TabsContent value="branches" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-4">Branches</h2>
              <form onSubmit={addBranch} className="grid grid-cols-2 gap-2 mb-4">
                <Input placeholder="Branch name" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
                <Input placeholder="Location" value={newBranch.location} onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })} />
                <Textarea className="col-span-2" placeholder="Description (optional)" rows={2} value={newBranch.description} onChange={(e) => setNewBranch({ ...newBranch, description: e.target.value })} />
                <Button type="submit" className="col-span-2">Add Branch</Button>
              </form>
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {sortedBranches.map((b) => (
                  <div key={b.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary border border-border">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {b.name}
                        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 shrink-0 ${
                          b.is_active ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                        }`}>{b.is_active ? "active" : "inactive"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{b.location}</div>
                      {b.description && (
                        <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">{b.description}</div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 mt-0.5" onClick={() => toggleBranch(b)}>
                      {b.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ))}
                {branches.length === 0 && <p className="text-sm text-muted-foreground">No branches yet.</p>}
              </div>
            </Card>

            <Card className="p-6 bg-card border-border shadow-card">
              <h2 className="font-semibold text-lg mb-4">Admin Assignments</h2>
              <form onSubmit={assign} className="grid grid-cols-2 gap-2 mb-4">
                <select value={assignForm.admin_id} onChange={(e) => setAssignForm({ ...assignForm, admin_id: e.target.value })} className="col-span-2 h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                  <option value="">Select admin</option>
                  {adminProfiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>)}
                </select>
                <select value={assignForm.branch_id} onChange={(e) => setAssignForm({ ...assignForm, branch_id: e.target.value })} className="col-span-2 h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                  <option value="">Select branch</option>
                  {sortedBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Button type="submit" className="col-span-2">Assign Admin to Branch</Button>
              </form>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                    <div className="text-sm"><span className="font-medium">{nameOf(a.admin_id)}</span> → <span className="text-muted-foreground">{branchName(a.branch_id)}</span></div>
                    <Button size="icon" variant="ghost" onClick={() => removeAssignment(a.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Bookings ── */}
        <TabsContent value="bookings">
          <Card className="p-6 bg-card border-border shadow-card">
            <h2 className="font-semibold text-lg mb-4">All Bookings <span className="text-sm font-normal text-muted-foreground">({bookings.length})</span></h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {bookings.map((b) => {
                const meta = parseNotes(b.notes);
                return (
                  <div key={b.id} className="p-3 rounded-lg bg-secondary border border-border space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{serviceName(b.service_id)} <span className="text-muted-foreground font-normal">·</span> <span className="text-muted-foreground">{nameOf(b.user_id)}</span></div>
                        <div className="text-xs text-muted-foreground">{branchName(b.branch_id)} · {new Date(b.booking_date).toLocaleString()} · <span className="text-emerald-400 font-medium">₱{Number(b.amount).toFixed(0)}</span></div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        b.status === "pending"    ? "border-amber-500/40 text-amber-400" :
                        b.status === "confirmed"  ? "border-cyan-500/40 text-cyan-400" :
                        b.status === "picked_up"  ? "border-blue-500/40 text-blue-400" :
                        b.status === "on_the_way" ? "border-violet-500/40 text-violet-400" :
                        b.status === "completed"  ? "border-emerald-500/40 text-emerald-400" :
                        b.status === "cancelled"  ? "border-red-500/40 text-red-400" : "border-gray-500/40 text-gray-400"
                      }`}>{{
                        pending: "Pending", confirmed: "Accepted", picked_up: "Picked Up",
                        on_the_way: "On The Way", completed: "Completed", cancelled: "Cancelled", rejected: "Declined",
                      }[b.status] ?? b.status}</span>
                    </div>
                    {meta && (
                      <div className="grid sm:grid-cols-2 gap-1">
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="truncate">{meta.pickup?.address ?? "—"}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Navigation2 className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                          <span className="truncate">{meta.dropoff?.address ?? "—"}</span>
                        </div>
                        {meta.distanceKm > 0 && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground sm:col-span-2">
                            <Route className="w-3 h-3 text-violet-400" />
                            <span>{meta.distanceKm?.toFixed(1)} km · {Math.round(meta.durationMin ?? 0)} min est.</span>
                          </div>
                        )}
                      </div>
                    )}
                    {b.driver_id && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="w-3 h-3 text-violet-400 shrink-0" />
                        <span>Driver: <span className="font-medium text-violet-300">{nameOf(b.driver_id)}</span></span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 flex-wrap">
                      {([
                        { key: "confirmed",  label: "Accepted",   active: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",        idle: "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" },
                        { key: "picked_up",  label: "Picked Up",  active: "bg-blue-500/20 text-blue-300 border-blue-500/50",        idle: "border-blue-500/40 text-blue-400 hover:bg-blue-500/10" },
                        { key: "on_the_way", label: "On The Way", active: "bg-violet-500/20 text-violet-300 border-violet-500/50",  idle: "border-violet-500/40 text-violet-400 hover:bg-violet-500/10" },
                        { key: "completed",  label: "Completed",  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50", idle: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" },
                        { key: "cancelled",  label: "Cancel",     active: "bg-red-500/20 text-red-300 border-red-500/50",           idle: "border-red-500/40 text-red-400 hover:bg-red-500/10" },
                        { key: "rejected",   label: "Reject",     active: "bg-gray-500/20 text-gray-300 border-gray-500/50",        idle: "border-gray-500/40 text-gray-400 hover:bg-gray-500/10" },
                      ] as const).map(({ key, label, active, idle }) => (
                        <button key={key} disabled={b.status === key} onClick={() => overrideBooking(b.id, key)}
                          className={`h-7 px-2.5 text-xs font-medium rounded-full border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${b.status === key ? active : idle}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ── Audit Logs ── */}
        <TabsContent value="logs">
          <Card className="p-6 bg-card border-border shadow-card">
            <h2 className="font-semibold text-lg mb-4">Audit Logs</h2>
            <div className="space-y-1 max-h-[540px] overflow-y-auto text-sm">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-secondary border border-border">
                  <span><span className="font-medium">{nameOf(l.actor_id ?? "")}</span> <span className="text-violet-400 font-mono text-xs">{l.action}</span> <span className="text-muted-foreground">{l.entity_type}</span></span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* ── Platform Settings ── */}
        <TabsContent value="settings">
          <Card className="p-6 bg-card border-border shadow-card">
            <h2 className="font-semibold text-lg mb-1">Platform Settings</h2>
            <p className="text-sm text-muted-foreground mb-5">Global configuration for the SmartDrop platform.</p>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { key: "platform_name",    label: "Platform Name",       type: "text" },
                { key: "base_fare",         label: "Base Fare (₱)",        type: "number" },
                { key: "per_km_rate",       label: "Per Km Rate (₱)",      type: "number" },
                { key: "commission_rate",   label: "Commission Rate (%)",  type: "number" },
              ].map(({ key, label, type }) => {
                const val = platformSettings[key] ?? "";
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <div className="flex gap-2">
                      <Input type={type} defaultValue={val} id={`setting-${key}`}
                        className="h-9 flex-1 bg-secondary border-border text-sm" />
                      <Button size="sm" disabled={savingSettings}
                        onClick={() => { const el = document.getElementById(`setting-${key}`) as HTMLInputElement; void saveSetting(key, el?.value ?? val); }}
                        className="h-9 px-3 text-xs">
                        Save
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="sm:col-span-2 space-y-1.5 pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground">Maintenance Mode</label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                  <div>
                    <div className="text-sm font-medium">Take system offline</div>
                    <div className="text-xs text-muted-foreground">Prevents new bookings from being created.</div>
                  </div>
                  <button
                    onClick={() => void saveSetting("maintenance_mode", platformSettings["maintenance_mode"] === "true" ? "false" : "true")}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      platformSettings["maintenance_mode"] === "true" ? "bg-red-500" : "bg-secondary border border-border"
                    }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      platformSettings["maintenance_mode"] === "true" ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
