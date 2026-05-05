import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Service { id: string; name: string; price: number; branch_id: string; description: string | null; }
interface Branch { id: string; name: string; location: string | null; }
interface Booking { id: string; booking_date: string; status: string; amount: number; service_id: string; branch_id: string; }

export default function UserDashboard() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => { void load(); }, [user]);

  async function load() {
    const [svc, br, bk] = await Promise.all([
      supabase.from("services").select("*").eq("is_active", true),
      supabase.from("branches").select("*").eq("is_active", true),
      user ? supabase.from("bookings").select("*").eq("user_id", user.id).order("booking_date", { ascending: false }) : Promise.resolve({ data: [] as Booking[] }),
    ]);
    setServices((svc.data ?? []) as Service[]);
    setBranches((br.data ?? []) as Branch[]);
    setBookings((bk.data ?? []) as Booking[]);
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!serviceId || !date) { toast.error("Pick a service and date"); return; }
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    const { error } = await supabase.from("bookings").insert({
      user_id: user.id, service_id: svc.id, branch_id: svc.branch_id,
      booking_date: new Date(date).toISOString(), amount: svc.price,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Booking submitted");
    setServiceId(""); setDate("");
    void load();
  }

  async function cancel(id: string) {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled");
    void load();
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Service";

  return (
    <AppShell title="My bookings" nav={[{ to: "/dashboard", label: "Dashboard" }]}>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> New booking</h2>
          <form onSubmit={handleBook} className="space-y-3">
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="bg-secondary border-border h-12"><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — ₱{Number(s.price).toFixed(2)} · {branchName(s.branch_id)}</SelectItem>
                ))}
                {services.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No services available yet</div>}
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border h-12" />
            <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-12">
              <Calendar className="w-4 h-4 mr-2" /> Submit booking
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-card border-border shadow-card">
          <h2 className="font-semibold text-lg mb-4">Booking history</h2>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                <div>
                  <div className="font-medium">{serviceName(b.service_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {branchName(b.branch_id)} · {new Date(b.booking_date).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{b.status}</Badge>
                  {(b.status === "pending" || b.status === "confirmed") && (
                    <Button size="icon" variant="ghost" onClick={() => cancel(b.id)} title="Cancel">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
