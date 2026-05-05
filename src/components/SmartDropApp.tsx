import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Navigation, Clock, Shield, Bell, Route,
  Car, Users, Star, ArrowRight, Menu, CheckCircle2
} from "lucide-react";
import logo from "@/assets/smartdrop-logo.jpg";
import heroImg from "@/assets/hero-city.jpg";
import { toast } from "sonner";

const features = [
  { icon: Navigation, title: "Real-Time GPS Tracking", desc: "Watch your ride approach live on the map with continuous location updates." },
  { icon: Clock, title: "Smart Scheduling", desc: "Book pick-ups and drop-offs in advance — no more guesswork or waiting." },
  { icon: Route, title: "Route Optimization", desc: "Algorithms calculate the fastest, smoothest path to your destination." },
  { icon: Bell, title: "Instant Notifications", desc: "Stay informed about arrivals, delays, and route changes the moment they happen." },
  { icon: Shield, title: "Verified Drivers", desc: "Every driver is verified with license and vehicle registration on file." },
  { icon: Users, title: "Built for Commuters", desc: "Designed for students, employees, and daily travelers in urban areas." },
];

const steps = [
  { n: "01", title: "Book your ride", desc: "Set your pickup and drop-off in seconds." },
  { n: "02", title: "Track in real time", desc: "Watch your driver approach on the live map." },
  { n: "03", title: "Ride with ease", desc: "Arrive on time, every time, with full transparency." },
];

export default function SmartDropApp() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff) {
      toast.error("Please enter both pick-up and drop-off locations.");
      return;
    }
    toast.success(`Searching rides from ${pickup} to ${dropoff}…`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <nav className="container flex items-center justify-between h-16">
          <a href="#" className="flex items-center gap-2">
            <img src={logo} alt="SmartDrop logo" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-lg tracking-tight">SmartDrop</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-smooth">Features</a>
            <a href="#how" className="hover:text-foreground transition-smooth">How it works</a>
            <a href="#about" className="hover:text-foreground transition-smooth">About</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow">
              Book a ride
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden"><Menu /></Button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <img
          src={heroImg}
          alt="Night city with glowing route trails"
          width={1536}
          height={1024}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />

        <div className="container relative py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
              Ride with ease
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              Organized commuting,{" "}
              <span className="text-gradient-brand">on demand.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              SmartDrop is a smarter way to get around the city. Book pick-ups, track your ride in real time,
              and skip the waiting — built for daily commuters.
            </p>

            {/* Booking card */}
            <Card className="p-4 md:p-6 bg-card/80 backdrop-blur-md border-border shadow-card max-w-xl">
              <form onSubmit={handleBook} className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <Input
                    placeholder="Pick-up location"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="pl-10 bg-secondary border-border h-12"
                  />
                </div>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <Input
                    placeholder="Drop-off location"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    className="pl-10 bg-secondary border-border h-12"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-12">
                  Find a ride <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </Card>

            <div className="flex items-center gap-6 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Verified drivers</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Live tracking</div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {[
              { icon: Car, k: "12K+", v: "Daily rides" },
              { icon: Users, k: "8K+", v: "Active commuters" },
              { icon: Clock, k: "3 min", v: "Avg. wait time" },
              { icon: Star, k: "4.9", v: "Driver rating" },
            ].map(({ icon: Icon, k, v }) => (
              <Card key={v} className="p-6 bg-card/70 backdrop-blur-md border-border shadow-card">
                <Icon className="w-6 h-6 text-primary mb-3" />
                <div className="text-3xl font-bold">{k}</div>
                <div className="text-sm text-muted-foreground">{v}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container py-24">
        <div className="max-w-2xl mb-12">
          <Badge className="bg-primary/15 text-primary border border-primary/30 mb-4">Features</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Everything you need for a <span className="text-gradient-brand">smoother commute</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 bg-card border-border hover:border-primary/40 transition-smooth shadow-card group">
              <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mb-4 shadow-glow group-hover:scale-110 transition-smooth">
                <Icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-border bg-card/30">
        <div className="container py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="bg-primary/15 text-primary border border-primary/30 mb-4">How it works</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Three steps to ride</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <Card key={s.n} className="p-8 bg-card border-border shadow-card relative overflow-hidden">
                <div className="text-6xl font-bold text-gradient-brand mb-4">{s.n}</div>
                <h3 className="font-semibold text-xl mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="container py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge className="bg-primary/15 text-primary border border-primary/30 mb-4">About SmartDrop</Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Built to solve <span className="text-gradient-brand">real commuter problems</span>
          </h2>
          <p className="text-muted-foreground mb-4">
            Urban commuting is plagued by traffic, unorganized transport, and long waits.
            SmartDrop tackles these head-on by combining GPS tracking, smart scheduling, and
            cloud-based coordination into one easy mobile experience.
          </p>
          <p className="text-muted-foreground">
            Our mission is to make daily transportation more structured, predictable,
            and user-friendly — for commuters, drivers, and operators alike.
          </p>
        </div>
        <Card className="p-8 bg-card border-border shadow-card">
          <h3 className="font-semibold text-xl mb-6">Who SmartDrop is for</h3>
          <ul className="space-y-4">
            {[
              { t: "Commuters", d: "Students, employees, and daily travelers." },
              { t: "Drivers", d: "Professionals seeking organized passenger allocation." },
              { t: "Operators", d: "Companies managing fleets and routes." },
            ].map((i) => (
              <li key={i.t} className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow">
                  <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-medium">{i.t}</div>
                  <div className="text-sm text-muted-foreground">{i.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <Card className="relative overflow-hidden p-12 md:p-16 text-center border-border shadow-glow"
              style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute inset-0 opacity-20" style={{ background: "var(--gradient-glow)" }} />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Ready to ride with ease?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Join thousands of commuters making their daily travel smarter, safer, and more reliable.
            </p>
            <Button size="lg" variant="secondary" className="h-12 px-8" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              Book your ride <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </Card>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SmartDrop" width={24} height={24} className="rounded" />
            <span>© 2026 SmartDrop. Ride with ease.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-smooth">Privacy</a>
            <a href="#" className="hover:text-foreground transition-smooth">Terms</a>
            <a href="#" className="hover:text-foreground transition-smooth">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
