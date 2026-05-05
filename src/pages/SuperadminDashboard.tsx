import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type AppRole = "superadmin" | "admin" | "user";
interface Profile { id: string; user_id: string; display_name: string | null; email: string | null; is_active: boolean; }
interface RoleRow { user_id: string; role: AppRole; }
interface Branch { id: string; name: string; location: string | null; is_active: boolean; }
interface Booking { id: string; booking_date: string; status: string; amount: number; user_id: string; branch_id: string; service_id: string; }
interface Audit { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; created_at: string; }
interface Assignment { id: string; admin_id: string; branch_id: string; }

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
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }).limit(200),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("admin_branches").select("*"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoles((r.data ?? []) as RoleRow[]);
    setBranches((b.data ?? []) as Branch[]);
    setBookings((bk.data ?? []) as Booking[]);
    setLogs((l.data ?? []) as Audit[]);
    setAssignments((a.data ?? []) as Assignment[]);
  }

  function rolesOf(uid: string): AppRole[] {
    return roles.filter((r) => r.user_id === uid).map((r) => r.role);
  }

  async function setRole(uid: string, role: AppRole, enable: boolean) {
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

  async function overrideBooking(id: string, status: string) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: `booking.override.${status}`, entity_type: "booking", entity_id: id });
    void load();
  }

  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount), 0);
  const adminProfiles = profiles.filter((p) => rolesOf(p.user_id).includes("admin"));
  const nameOf = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name || profiles.find((p) => p.user_id === uid)?.email || uid.slice(0, 8);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name || "—";

  return (
    <AppShell title="Superadmin console" nav={[{ to: "/superadmin", label: "Superadmin" }, { to: "/admin", label: "Admin" }, { to: "/dashboard", label: "User view" }]}>
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Total bookings</div><div className="text-3xl font-bold mt-1">{bookings.length}</div></Card>
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Revenue (completed)</div><div className="text-3xl font-bold mt-1">₱{totalRevenue.toFixed(2)}</div></Card>
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Active users</div><div className="text-3xl font-bold mt-1">{profiles.filter((p) => p.is_active).length}</div></Card>
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Branches</div><div className="text-3xl font-bold mt-1">{branches.length}</div></Card>
      </div>

      <Card className="p-6 bg-card border-border shadow-card">
        <h2 className="font-semibold text-lg mb-4">Users & roles</h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {profiles.map((p) => {
            const r = rolesOf(p.user_id);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-secondary border border-border">
                <div>
                  <div className="font-medium">{p.display_name || p.email}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["user", "admin", "superadmin"] as AppRole[]).map((role) => (
                    <Button key={role} size="sm" variant={r.includes(role) ? "default" : "outline"} onClick={() => setRole(p.user_id, role, !r.includes(role))}>
                      {role}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                    <Badge variant="outline">{p.is_active ? "active" : "deactivated"}</Badge>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h2 className="font-semibold text-lg mb-4">Branches</h2>
          <form onSubmit={addBranch} className="grid grid-cols-3 gap-2 mb-4">
            <Input placeholder="Name" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
            <Input placeholder="Location" value={newBranch.location} onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })} />
            <Button type="submit">Add</Button>
            <Textarea className="col-span-3" placeholder="Description" value={newBranch.description} onChange={(e) => setNewBranch({ ...newBranch, description: e.target.value })} />
          </form>
          <div className="space-y-2">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.location}</div></div>
                <Badge variant="outline">{b.is_active ? "active" : "inactive"}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-card border-border shadow-card">
          <h2 className="font-semibold text-lg mb-4">Admin assignments</h2>
          <form onSubmit={assign} className="grid grid-cols-3 gap-2 mb-4">
            <select value={assignForm.admin_id} onChange={(e) => setAssignForm({ ...assignForm, admin_id: e.target.value })}
              className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
              <option value="">Admin</option>
              {adminProfiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>)}
            </select>
            <select value={assignForm.branch_id} onChange={(e) => setAssignForm({ ...assignForm, branch_id: e.target.value })}
              className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
              <option value="">Branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Button type="submit">Assign</Button>
          </form>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                <div className="text-sm">{nameOf(a.admin_id)} → <span className="text-muted-foreground">{branchName(a.branch_id)}</span></div>
                <Button size="icon" variant="ghost" onClick={() => removeAssignment(a.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-card border-border shadow-card">
        <h2 className="font-semibold text-lg mb-4">All bookings</h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-secondary border border-border">
              <div>
                <div className="font-medium">{nameOf(b.user_id)} · {branchName(b.branch_id)}</div>
                <div className="text-xs text-muted-foreground">{new Date(b.booking_date).toLocaleString()} · ₱{Number(b.amount).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline">{b.status}</Badge>
                {["confirmed", "cancelled", "completed"].map((s) => (
                  <Button key={s} size="sm" variant="ghost" disabled={b.status === s} onClick={() => overrideBooking(b.id, s)}>{s}</Button>
                ))}
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings.</p>}
        </div>
      </Card>

      <Card className="p-6 bg-card border-border shadow-card">
        <h2 className="font-semibold text-lg mb-4">Audit logs</h2>
        <div className="space-y-1 max-h-[300px] overflow-y-auto text-sm">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-2 rounded bg-secondary border border-border">
              <span><span className="font-mono text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span> — <strong>{nameOf(l.actor_id ?? "")}</strong> {l.action} <span className="text-muted-foreground">{l.entity_type}</span></span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
