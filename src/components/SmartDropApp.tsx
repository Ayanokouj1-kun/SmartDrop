import { useInView } from "@/hooks/useInView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Navigation, Clock, Shield, Bell, Route,
  Users, ArrowRight, Menu, CheckCircle2, Star, Quote,
  MapPin, Phone, Mail
} from "lucide-react";
import logo from "@/assets/smartdrop-logo.png";
import heroImg from "@/assets/hero-city.jpg";

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

const testimonials = [
  {
    name: "Jade Maria Santos",
    role: "Daily commuter · Kalibo",
    initials: "jMS",
    gradient: "from-violet-500 to-indigo-600",
    quote: "SmartDrop completely changed how I get to work. I know exactly when my ride arrives — no more standing at the terminal guessing.",
    highlight: "No more guessing",
  },
  {
    name: "Kim Matthew Dela Cruz",
    role: "College student · Aklan State University",
    initials: "KMJD",
    gradient: "from-emerald-500 to-teal-600",
    quote: "Booking a ride home after class used to stress me out. Now I just set my pickup on the map and I'm done. Super convenient!",
    highlight: "Super convenient",
  },
  {
    name: "Anna Reyes",
    role: "Office worker · Kalibo Capitol",
    initials: "AR",
    gradient: "from-rose-500 to-pink-600",
    quote: "I love seeing the fare estimate before confirming. No surprises, no haggling — exactly what I needed for my daily commute.",
    highlight: "No surprises",
  },
  {
    name: "Carlo Mendoza",
    role: "Driver · SmartDrop Partner",
    initials: "CM",
    gradient: "from-amber-500 to-orange-500",
    quote: "As a driver, SmartDrop gives me organized trips. I know my passengers ahead of time and the routes are always clear.",
    highlight: "Organized trips",
  },
  {
    name: "Liza Mae Villanueva",
    role: "Nurse · Kalibo Provincial Hospital",
    initials: "LMV",
    gradient: "from-sky-500 to-blue-600",
    quote: "Night shifts used to mean uncertain rides home. SmartDrop lets me pre-book before I even clock out. It's a lifesaver.",
    highlight: "A lifesaver",
  },
  {
    name: "Renz Bautista",
    role: "Entrepreneur · Malay",
    initials: "RB",
    gradient: "from-fuchsia-500 to-purple-600",
    quote: "Managing supplier pickups was a headache. SmartDrop streamlined everything — I can track every trip and plan my day properly.",
    highlight: "Streamlined everything",
  },
];

export default function SmartDropApp() {
  const [featHeadRef, featHeadInView] = useInView<HTMLDivElement>();
  const [featGridRef, featGridInView] = useInView<HTMLDivElement>();
  const [howHeadRef, howHeadInView] = useInView<HTMLDivElement>();
  const [stepsRef, stepsInView] = useInView<HTMLDivElement>();
  const [aboutRef, aboutInView] = useInView<HTMLElement>();
  const [testRef, testInView] = useInView<HTMLElement>();

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
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => (window.location.href = "/signin")}>Sign in</Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow" onClick={() => (window.location.href = "/signin")}>
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
          alt="Philippine roadway with jeepneys and tricycles"
          width={1536}
          height={1024}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />

        <div className="container relative py-14 sm:py-20 md:py-24 lg:py-32 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-5 lg:space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Organized commuting,{" "}
              <span className="text-gradient-brand">made simple.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl">
              SmartDrop is a concept being built for Filipino commuters — a simpler way to book
              pick-ups, plan routes, and travel with structure. We're just getting started.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-12 px-8" onClick={() => (window.location.href = "/signin")}>
                Get started <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {["from-violet-500 to-indigo-600","from-emerald-500 to-teal-600","from-rose-500 to-pink-600","from-amber-500 to-orange-500"].map((g, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-background`} />
                ))}
              </div>
              <span>Trusted by commuters across Kalibo &amp; Aklan</span>
            </div>
          </div>

          {/* Concept pillars */}
          <div className="hidden lg:grid grid-cols-1 gap-4">
            {[
              { icon: Navigation, t: "Plan your trip", d: "Set pick-up and drop-off points before you leave home." },
              { icon: Route, t: "Smarter routing", d: "Suggested paths based on your destination and area." },
              { icon: Shield, t: "Driver accountability", d: "Drivers register and verify before accepting trips." },
            ].map(({ icon: Icon, t, d }) => (
              <Card key={t} className="p-5 bg-card/70 backdrop-blur-md border-border shadow-card flex gap-4 items-start">
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
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container py-14 sm:py-20 md:py-24">
        <div ref={featHeadRef} className={`max-w-2xl mb-8 md:mb-12 scroll-reveal${featHeadInView ? " is-visible" : ""}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Everything you need for a <span className="text-gradient-brand">smoother commute</span>
          </h2>
        </div>
        <div ref={featGridRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <Card key={title} className={`p-6 bg-card border-border hover:border-primary/40 transition-smooth shadow-card group scroll-reveal scroll-delay-${(i + 1) * 100}${featGridInView ? " is-visible" : ""}`}>
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
        <div className="container py-14 sm:py-20 md:py-24">
          <div ref={howHeadRef} className={`text-center max-w-2xl mx-auto mb-8 md:mb-12 scroll-reveal${howHeadInView ? " is-visible" : ""}`}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Three steps to ride</h2>
          </div>
          <div ref={stepsRef} className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <Card key={s.n} className={`p-8 bg-card border-border shadow-card relative overflow-hidden scroll-reveal scroll-delay-${(i + 1) * 100}${stepsInView ? " is-visible" : ""}`}>
                <div className="text-6xl font-bold text-gradient-brand mb-4">{s.n}</div>
                <h3 className="font-semibold text-xl mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" ref={aboutRef} className="container py-14 sm:py-20 md:py-24 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className={`scroll-reveal${aboutInView ? " is-visible" : ""}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6">
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
        <Card className={`p-8 bg-card border-border shadow-card scroll-reveal scroll-delay-200${aboutInView ? " is-visible" : ""}`}>
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

      {/* TESTIMONIALS */}
      <section id="testimonials" ref={testRef} className="container pb-14 sm:pb-20 md:pb-24">
        <div className={`text-center max-w-2xl mx-auto mb-8 md:mb-12 scroll-reveal${testInView ? " is-visible" : ""}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Real riders, <span className="text-gradient-brand">real results</span>
          </h2>
          <p className="mt-4 text-muted-foreground">See what commuters and drivers across the Philippines are saying about SmartDrop.</p>
        </div>
        <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-5 scroll-reveal${testInView ? " is-visible" : ""}`}>
          {testimonials.map((t, i) => (
            <Card key={t.name} className={`p-6 bg-card border-border shadow-card flex flex-col gap-4 hover:border-primary/30 transition-smooth scroll-delay-${(i % 3 + 1) * 100}`}>
              {/* Stars */}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              {/* Quote */}
              <div className="relative flex-1">
                <Quote className="w-6 h-6 text-violet-400/30 mb-1" />
                <p className="text-sm text-foreground/90 leading-relaxed">{t.quote}</p>
              </div>
              {/* Highlight badge */}
              <div>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-violet-300 border border-violet-500/20">
                  ✦ {t.highlight}
                </span>
              </div>
              {/* Person */}
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm`}>
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SmartDrop. All rights reserved.</span>
          <span>Powered by SmartDrop — Ride with ease, arrive with confidence.</span>
        </div>
      </footer>
    </div>
  );
}
