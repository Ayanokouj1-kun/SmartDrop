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
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type AppRole = "superadmin" | "admin" | "user";
interface Profile { id: string; user_id: string; display_name: string | null; email: string | null; username: string | null; is_active: boolean; }
interface RoleRow { user_id: string; role: AppRole; }
interface Branch { id: string; name: string; location: string | null; description: string | null; is_active: boolean; }
interface Booking { id: string; booking_date: string; status: string; amount: number; user_id: string; branch_id: string; }
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [logs, setLogs] = useState<Audit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newBranch, setNewBranch] = useState({ name: "", location: "", description: "" });
  const [assignForm, setAssignForm] = useState({ admin_id: "", branch_id: "" });

  useEffect(() => { void load(); }, []);

  async function load() {
    const [p, r, b, bk, l, a] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("branches").select("*"),
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }).limit(500),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_branches").select("*"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoles((r.data ?? []) as RoleRow[]);
    setBranches((b.data ?? []) as Branch[]);
    setBookings((bk.data ?? []) as Booking[]);
    setLogs((l.data ?? []) as Audit[]);
    setAssignments((a.data ?? []) as Assignment[]);
  }

  const rolesOf = (uid: string): AppRole[] => roles.filter((r) => r.user_id === uid).map((r) => r.role);
  const isSuperadmin = (uid: string) => rolesOf(uid).includes("superadmin");
  const nameOf = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name ?? profiles.find((p) => p.user_id === uid)?.email ?? uid.slice(0, 8);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const adminProfiles = profiles.filter((p) => rolesOf(p.user_id).includes("admin"));

  async function setRole(uid: string, role: AppRole, enable: boolean) {
    if (isSuperadmin(uid)) return toast.error("Superadmin role cannot be modified.");
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

  async function overrideBooking(id: string, status: "pending" | "confirmed" | "completed" | "cancelled" | "rejected") {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: `booking.override.${status}`, entity_type: "booking", entity_id: id });
    void load();
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  const now = new Date();
  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0);

  const last7Rev = useMemo(() => bookings.filter((b) => { try { return b.status === "completed" && isAfter(parseISO(b.booking_date), subDays(now, 7)); } catch { return false; } }).reduce((s, b) => s + Number(b.amount), 0), [bookings]);
  const prev7Rev = useMemo(() => bookings.filter((b) => { try { const d = parseISO(b.booking_date); return b.status === "completed" && isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7)); } catch { return false; } }).reduce((s, b) => s + Number(b.amount), 0), [bookings]);
  const revTrend = prev7Rev > 0 ? Math.round(((last7Rev - prev7Rev) / prev7Rev) * 100) : null;

  const last7Bk = useMemo(() => bookings.filter((b) => { try { return isAfter(parseISO(b.booking_date), subDays(now, 7)); } catch { return false; } }).length, [bookings]);
  const prev7Bk = useMemo(() => bookings.filter((b) => { try { const d = parseISO(b.booking_date); return isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7)); } catch { return false; } }).length, [bookings]);
  const bkTrend = prev7Bk > 0 ? Math.round(((last7Bk - prev7Bk) / prev7Bk) * 100) : null;

  const bookingTrend = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = subDays(now, 29 - i);
    const key = format(d, "MMM d");
    const dayBk = bookings.filter((b) => { try { return format(parseISO(b.booking_date), "MMM d") === key; } catch { return false; } });
    return { date: key, bookings: dayBk.length, revenue: dayBk.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0) };
  }), [bookings]);

  const revByBranch = useMemo(() => branches.map((br) => ({
    name: br.name.length > 14 ? br.name.slice(0, 14) + "…" : br.name,
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
    if (bookings.length === 0) return [{ type: "info" as const, icon: <Info className="w-4 h-4" />, text: "No booking data yet. Insights will appear as bookings come in." }];
    return insights;
  }, [bookings, revByBranch, profiles, revTrend]);

  const insightColors: Record<string, string> = { success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", warning: "border-amber-500/30 bg-amber-500/10 text-amber-400", danger: "border-red-500/30 bg-red-500/10 text-red-400", info: "border-blue-500/30 bg-blue-500/10 text-blue-400" };

  return (
    <AppShell title="Superadmin Console" nav={[]}>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Calendar className="w-5 h-5 text-violet-400" />, label: "Total Bookings", value: bookings.length, trend: bkTrend },
          { icon: <DollarSign className="w-5 h-5 text-emerald-400" />, label: "Revenue (completed)", value: `₱${totalRevenue.toFixed(2)}`, trend: revTrend },
          { icon: <Users className="w-5 h-5 text-cyan-400" />, label: "Active Users", value: profiles.filter((p) => p.is_active).length, trend: null },
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
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-400" />Booking & Revenue Trend (30 days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bookingTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gbk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="grev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="bookings" stroke="#8b5cf6" fill="url(#gbk)" strokeWidth={2} name="Bookings" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#grev)" strokeWidth={2} name="Revenue (₱)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-6 bg-card border-border shadow-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" />Revenue by Branch</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revByBranch} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`₱${v.toFixed(2)}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
            <h2 className="font-semibold text-lg mb-4">Users & Roles</h2>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {profiles.map((p) => {
                const r = rolesOf(p.user_id);
                const locked = isSuperadmin(p.user_id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-secondary border border-border">
                    <div className="flex items-center gap-2">
                      {locked && <Shield className="w-4 h-4 text-violet-400 shrink-0" title="Superadmin — locked" />}
                      <div>
                        <div className="font-medium flex items-center gap-1.5">{p.display_name || p.email}{locked && <Badge className="text-[10px] py-0 px-1.5 bg-violet-500/20 text-violet-300 border-violet-500/30">superadmin</Badge>}</div>
                        <div className="text-xs text-muted-foreground">{p.email}{p.username ? ` · @${p.username}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {locked ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="w-3.5 h-3.5" />Role locked</span>
                      ) : (
                        (["user", "admin"] as AppRole[]).map((role) => (
                          <Button key={role} size="sm" variant={r.includes(role) ? "default" : "outline"} onClick={() => setRole(p.user_id, role, !r.includes(role))}>
                            {role}
                          </Button>
                        ))
                      )}
                      <Button size="sm" variant="ghost" disabled={locked} onClick={() => toggleActive(p)}>
                        <Badge variant="outline" className={p.is_active ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>{p.is_active ? "active" : "deactivated"}</Badge>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {profiles.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
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
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                    <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.location}</div></div>
                    <Button size="sm" variant="ghost" onClick={() => toggleBranch(b)}>
                      <Badge variant="outline" className={b.is_active ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>{b.is_active ? "active" : "inactive"}</Badge>
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
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-secondary border border-border">
                  <div>
                    <div className="font-medium text-sm">{nameOf(b.user_id)} · {branchName(b.branch_id)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(b.booking_date).toLocaleString()} · ₱{Number(b.amount).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{b.status}</Badge>
                    {(["confirmed", "completed", "cancelled"] as const).map((s) => (
                      <Button key={s} size="sm" variant="ghost" disabled={b.status === s} onClick={() => overrideBooking(b.id, s)} className="text-xs h-7 px-2">{s}</Button>
                    ))}
                  </div>
                </div>
              ))}
              {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
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
      </Tabs>
    </AppShell>
  );
}
