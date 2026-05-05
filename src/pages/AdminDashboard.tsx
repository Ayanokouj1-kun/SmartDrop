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

interface Branch { id: string; name: string; }
interface Service { id: string; branch_id: string; name: string; description: string | null; price: number; is_active: boolean; }
interface Booking { id: string; booking_date: string; status: string; amount: number; service_id: string; branch_id: string; user_id: string; }

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "rejected"] as const;

export default function AdminDashboard() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newSvc, setNewSvc] = useState({ branch_id: "", name: "", description: "", price: "" });

  useEffect(() => { void load(); }, [user]);

  async function load() {
    if (!user) return;
    const { data: assigned } = await supabase.from("admin_branches").select("branch_id, branches(id,name)").eq("admin_id", user.id);
    const branchList = (assigned ?? []).map((a: any) => a.branches).filter(Boolean) as Branch[];
    setBranches(branchList);
    const branchIds = branchList.map((b) => b.id);
    if (branchIds.length === 0) { setServices([]); setBookings([]); return; }
    const [svc, bk] = await Promise.all([
      supabase.from("services").select("*").in("branch_id", branchIds),
      supabase.from("bookings").select("*").in("branch_id", branchIds).order("booking_date", { ascending: false }),
    ]);
    setServices((svc.data ?? []) as Service[]);
    setBookings((bk.data ?? []) as Booking[]);
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!newSvc.branch_id || !newSvc.name) return toast.error("Branch and name required");
    const { error } = await supabase.from("services").insert({
      branch_id: newSvc.branch_id, name: newSvc.name,
      description: newSvc.description || null, price: Number(newSvc.price) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Service added");
    setNewSvc({ branch_id: "", name: "", description: "", price: "" });
    void load();
  }

  async function setStatus(id: string, status: typeof STATUSES[number]) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await supabase.from("audit_logs").insert({ actor_id: user.id, action: `booking.${status}`, entity_type: "booking", entity_id: id });
    void load();
  }

  async function toggleService(id: string, is_active: boolean) {
    const { error } = await supabase.from("services").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <AppShell title="Admin dashboard" nav={[{ to: "/admin", label: "Admin" }, { to: "/dashboard", label: "User view" }]}>
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Assigned branches</div><div className="text-3xl font-bold mt-1">{branches.length}</div></Card>
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Services</div><div className="text-3xl font-bold mt-1">{services.length}</div></Card>
        <Card className="p-5 bg-card border-border shadow-card"><div className="text-sm text-muted-foreground">Pending bookings</div><div className="text-3xl font-bold mt-1">{bookings.filter((b) => b.status === "pending").length}</div></Card>
      </div>

      {branches.length === 0 && (
        <Card className="p-6 bg-card border-border shadow-card text-sm text-muted-foreground">
          You haven't been assigned to any branch yet. Ask a superadmin to assign you.
        </Card>
      )}

      {branches.length > 0 && (
        <Card className="p-6 bg-card border-border shadow-card">
          <h2 className="font-semibold text-lg mb-4">Add a service</h2>
          <form onSubmit={addService} className="grid md:grid-cols-5 gap-3">
            <select value={newSvc.branch_id} onChange={(e) => setNewSvc({ ...newSvc, branch_id: e.target.value })}
              className="h-11 rounded-md border border-border bg-secondary px-3 text-sm">
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Input placeholder="Service name" value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} />
            <Input placeholder="Price" type="number" step="0.01" value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })} />
            <Textarea placeholder="Description" value={newSvc.description} onChange={(e) => setNewSvc({ ...newSvc, description: e.target.value })} className="md:col-span-1" />
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}

      <Card className="p-6 bg-card border-border shadow-card">
        <h2 className="font-semibold text-lg mb-4">Services</h2>
        <div className="space-y-2">
          {services.length === 0 && <p className="text-sm text-muted-foreground">No services yet.</p>}
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
              <div>
                <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">· ₱{Number(s.price).toFixed(2)}</span></div>
                <div className="text-xs text-muted-foreground">{branches.find((b) => b.id === s.branch_id)?.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "active" : "inactive"}</Badge>
                <Button variant="ghost" size="sm" onClick={() => toggleService(s.id, s.is_active)}>Toggle</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-card border-border shadow-card">
        <h2 className="font-semibold text-lg mb-4">Bookings</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
          {bookings.map((b) => {
            const svc = services.find((s) => s.id === b.service_id);
            return (
              <div key={b.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg bg-secondary border border-border">
                <div>
                  <div className="font-medium">{svc?.name ?? "Service"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(b.booking_date).toLocaleString()} · ₱{Number(b.amount).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{b.status}</Badge>
                  {STATUSES.map((s) => (
                    <Button key={s} size="sm" variant="ghost" disabled={b.status === s} onClick={() => setStatus(b.id, s)}>{s}</Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
