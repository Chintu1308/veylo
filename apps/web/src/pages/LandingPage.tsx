import {
  IconSun,
  IconMoon,
  IconChevronRight,
  IconShieldLock,
  IconMenu,
  IconX,
  IconShieldCheck,
  IconTerminal,
  IconActivity,
  IconLock,
  IconEye,
  IconDevices,
} from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// ── Corner Plus SVG Component ──────────────────────────
function CornerPlus({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute w-3.5 h-3.5 z-20 pointer-events-none stroke-border/40 ${className || ""}`}
    >
      <path d="M0 6.5H13" strokeWidth="1.2" />
      <path d="M6.5 0V13" strokeWidth="1.2" />
    </svg>
  );
}

// ── Rotating Earth Wireframe Canvas Component ────────────────────────────────
function RotatingEarth({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height;
      const radius = Math.max(canvas.width, canvas.height) * 0.72;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
      ctx.lineTo(cx + radius, cy);
      ctx.lineTo(cx - radius, cy);
      ctx.closePath();
      ctx.clip();

      const phi = 0.35;
      const yLight = cy - radius * Math.sin(phi);
      const xLight = cx + radius * Math.cos(phi) * Math.sin(angle);
      const isFront = Math.cos(angle) > 0;
      const intensity = isFront ? 1.0 : 0.25;

      const glowGrad = ctx.createRadialGradient(
        xLight,
        yLight,
        0,
        xLight,
        yLight,
        radius * 1.15
      );

      if (isDark) {
        glowGrad.addColorStop(0, `rgba(22, 199, 180, ${0.28 * intensity})`);
        glowGrad.addColorStop(0.4, `rgba(22, 199, 180, ${0.08 * intensity})`);
        glowGrad.addColorStop(1, "rgba(3, 2, 11, 0)");
      } else {
        glowGrad.addColorStop(0, `rgba(26, 124, 116, ${0.22 * intensity})`);
        glowGrad.addColorStop(0.4, `rgba(26, 124, 116, ${0.06 * intensity})`);
        glowGrad.addColorStop(1, "rgba(245, 246, 248, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius);
      ctx.restore();

      const strokeColor = isDark ? "rgba(22, 199, 180, 0.08)" : "rgba(26, 124, 116, 0.06)";
      const dotColor = isDark ? "rgba(22, 199, 180, 0.35)" : "rgba(26, 124, 116, 0.35)";

      // Draw Grid Meridians
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.0;

      const count = 9;
      for (let i = 0; i <= count; i++) {
        const theta = (i / count) * Math.PI;
        ctx.beginPath();
        for (let j = 0; j <= 50; j++) {
          const l = (j / 50) * Math.PI;
          const x = cx + radius * Math.cos(l) * Math.sin(theta + angle);
          const y = cy - radius * Math.sin(l);
          if (y <= cy) {
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Draw Latitudes
      for (let i = 1; i < 6; i++) {
        const latRatio = i / 6;
        const latRadius = radius * Math.sin(latRatio * Math.PI);
        const latY = cy - radius * Math.cos(latRatio * Math.PI);
        ctx.beginPath();
        for (let j = 0; j <= 50; j++) {
          const lon = (j / 50) * 2 * Math.PI + angle;
          const latX = cx + latRadius * Math.sin(lon);
          if (latY <= cy) {
            if (j === 0) ctx.moveTo(latX, latY);
            else ctx.lineTo(latX, latY);
          }
        }
        ctx.stroke();
      }

      // Draw connection dots
      ctx.fillStyle = dotColor;
      const dots = [
        { lat: 0.4, lon: 0.2 },
        { lat: -0.3, lon: 1.1 },
        { lat: 0.7, lon: -0.6 },
        { lat: -0.1, lon: 2.1 },
        { lat: 0.5, lon: 3.0 },
      ];
      dots.forEach((d) => {
        const lon = d.lon + angle;
        const latRadius = radius * Math.cos(d.lat);
        const latY = cy - radius * Math.sin(d.lat);
        const latX = cx + latRadius * Math.sin(lon);
        const isDotFront = Math.cos(lon) > 0;

        if (isDotFront && latY <= cy) {
          ctx.beginPath();
          ctx.arc(latX, latY, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      angle += 0.0022;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Main Page Redesign ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("veylo-theme");
    return saved ? saved === "dark" : true;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync variables and .dark class dynamically
  useEffect(() => {
    localStorage.setItem("veylo-theme", isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.setProperty("--color-bg", "#03020b");
      document.documentElement.style.setProperty("--color-surface", "#090812");
      document.documentElement.style.setProperty("--color-border", "rgba(255, 255, 255, 0.07)");
      document.documentElement.style.setProperty("--color-plus-line", "rgba(255, 255, 255, 0.12)");
      document.documentElement.style.setProperty("--color-text-primary", "#ffffff");
      document.documentElement.style.setProperty("--color-text-secondary", "rgba(255, 255, 255, 0.6)");
      document.documentElement.style.setProperty("--color-accent", "#16C7B4");
      document.documentElement.style.setProperty("--color-accent-hover", "#7DE6D6");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.setProperty("--color-bg", "#f5f6f8");
      document.documentElement.style.setProperty("--color-surface", "#ffffff");
      document.documentElement.style.setProperty("--color-border", "rgba(9, 10, 17, 0.08)");
      document.documentElement.style.setProperty("--color-plus-line", "rgba(9, 10, 17, 0.15)");
      document.documentElement.style.setProperty("--color-text-primary", "#090a11");
      document.documentElement.style.setProperty("--color-text-secondary", "rgba(9, 10, 17, 0.6)");
      document.documentElement.style.setProperty("--color-accent", "#1a7c74");
      document.documentElement.style.setProperty("--color-accent-hover", "#22b8a6");
    }
  }, [isDark]);



  // Scroll color fade text
  const textSectionRef = useRef<HTMLDivElement>(null);
  const [textProgress, setTextProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (!textSectionRef.current) return;
      const rect = textSectionRef.current.getBoundingClientRect();
      const viewHeight = window.innerHeight;
      const start = rect.top - viewHeight;
      const end = rect.bottom - viewHeight * 0.2;
      const total = end - start;
      const current = viewHeight - rect.top;
      const ratio = Math.min(Math.max(current / (total || 1), 0), 1);
      setTextProgress(ratio);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const coreStatement =
    "Veylo gives your organization a complete system to continuously track, evaluate, and isolate access requests — bringing identity verification, device posture, and network behavior together in one place.";
  const words = coreStatement.split(" ");

  const getWordOpacity = (index: number) => {
    const start = index / words.length;
    const end = start + 0.12;
    if (textProgress < start) return 0.25;
    if (textProgress > end) return 1.0;
    return 0.25 + 0.75 * ((textProgress - start) / 0.12);
  };

  return (
    <div className="w-full bg-background text-foreground font-sans min-h-screen flex flex-col transition-all duration-300 relative overflow-x-hidden selection:bg-accent/30">
      
      {/* ── Background Grid ── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-30 z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-accent/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* ── Navigation Header ── */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/60 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/10 transition-transform group-hover:scale-105">
              <IconShieldLock size={20} stroke={2.5} />
            </div>
            <div>
              <span className="font-fira-mono font-bold tracking-tight text-lg uppercase">Veylo</span>
              <span className="block text-[9px] text-muted-foreground tracking-widest uppercase leading-none font-medium">Verify Every Layer</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#product" className="text-muted-foreground hover:text-foreground transition-colors">Product</a>
            <a href="#detections" className="text-muted-foreground hover:text-foreground transition-colors">Detections</a>
            <a href="#forensics" className="text-muted-foreground hover:text-foreground transition-colors">Ledger</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-all cursor-pointer"
              aria-label="Toggle theme"
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <Link to="/login" className="text-sm font-semibold hover:text-primary transition-colors">Sign In</Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-accent hover:text-black rounded-lg transition-all shadow-md shadow-primary/5 cursor-pointer flex items-center gap-1.5"
            >
              Get Started
              <IconChevronRight size={14} />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2.5">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {mobileMenuOpen ? <IconX size={18} /> : <IconMenu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border/80 bg-background/95 backdrop-blur-md px-6 py-6 flex flex-col gap-4 animate-in slide-in-from-top duration-200">
            <a href="#product" onClick={() => setMobileMenuOpen(false)} className="font-medium py-1">Product</a>
            <a href="#detections" onClick={() => setMobileMenuOpen(false)} className="font-medium py-1">Detections</a>
            <a href="#forensics" onClick={() => setMobileMenuOpen(false)} className="font-medium py-1">Ledger</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="font-medium py-1">Pricing</a>
            <div className="h-px bg-border my-1" />
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="font-semibold py-1">Sign In</Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 text-center font-semibold text-primary-foreground bg-primary hover:bg-accent rounded-lg transition-all"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative w-full max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-32 flex flex-col lg:flex-row items-center justify-between gap-16 z-10">
        
        {/* Left Info Column */}
        <div className="flex-1 flex flex-col items-start gap-6 text-left">
          
          {/* Active Banner */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/30 text-primary text-[11px] font-fira-mono font-semibold uppercase tracking-wider rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Status: All Systems Operational
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground">
            Zero Trust Security, <br />
            <span className="text-primary bg-clip-text">Continuous Verification</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            Verify every layer of access — from organization identity and device posture to network anomalies and resource boundaries. Adapt dynamically to active risks mid-session.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/register"
              className="px-6 py-3.5 text-base font-bold text-primary-foreground bg-primary hover:bg-accent hover:text-black rounded-lg transition-all shadow-xl shadow-primary/10 flex items-center gap-2 cursor-pointer"
            >
              Start Free Trial
              <IconChevronRight size={16} />
            </Link>
            <a
              href="#product"
              className="px-6 py-3.5 text-base font-semibold border border-border bg-card/40 hover:bg-muted/10 rounded-lg transition-all"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Right Canvas Hemisphere & Interactive Demo View */}
        <div className="flex-1 w-full max-w-lg lg:max-w-xl aspect-square relative rounded-2xl border border-border/80 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col justify-end p-6 group">
          <RotatingEarth isDark={isDark} />

          {/* Floater: Active telemetry checking */}
          <div className="bg-card/90 backdrop-blur border border-border p-4 rounded-xl shadow-lg relative z-20 flex items-center gap-3.5 max-w-sm translate-y-2 group-hover:-translate-y-1 transition-transform duration-300">
            <div className="w-10 h-10 rounded-lg bg-status-low-bg text-status-low-text flex items-center justify-center shrink-0">
              <IconShieldCheck size={22} />
            </div>
            <div className="flex flex-col text-left overflow-hidden">
              <span className="font-semibold text-xs leading-tight">Access Granted</span>
              <span className="text-[10px] text-muted-foreground font-fira-mono truncate mt-0.5">SHA256: e8b2f9... · Risk Score: 12 (Low)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 02: Scroll Coloring Text ── */}
      <section ref={textSectionRef} className="w-full max-w-7xl mx-auto px-6 py-24 relative z-10 border-t border-border/40">
        <div className="max-w-4xl">
          <span className="text-[11px] font-fira-mono font-bold tracking-widest text-primary uppercase block mb-6">VEYLO PHILOSOPHY</span>
          <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-relaxed text-left">
            {words.map((word, idx) => (
              <span
                key={idx}
                style={{ opacity: getWordOpacity(idx) }}
                className="transition-opacity duration-150 mr-2 inline-block"
              >
                {word}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ── Section 03: Concentric Boundaries ── */}
      <section id="product" className="w-full max-w-7xl mx-auto px-6 py-24 border-t border-border/40 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] font-fira-mono font-bold tracking-widest text-primary uppercase block mb-3">CONCENTRIC SECURITY</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Concentric Zero Trust Boundaries</h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Veylo checks signals across all access layers. A compromise at any point triggers active, instant mitigations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <IconLock className="text-primary" size={24} />,
              title: "Identity & Organization",
              desc: "Verify emails, JWT signatures, and organization memberships with RLS-guarded access control.",
            },
            {
              icon: <IconDevices className="text-primary" size={24} />,
              title: "Device Posture",
              desc: "Continuously check device OS types, posture scores, and active endpoints dynamically.",
            },
            {
              icon: <IconActivity className="text-primary" size={24} />,
              title: "Network & Traffic",
              desc: "Analyze inbound traffic flows, ports, and geolocation contexts in real-time.",
            },
            {
              icon: <IconEye className="text-primary" size={24} />,
              title: "Behavior Detections",
              desc: "Compare active behaviors with risk matrices to block brute-force or enumeration attacks.",
            },
          ].map((item) => (
            <div key={item.title} className="p-6 bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 rounded-xl text-left flex flex-col gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">{item.icon}</div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 04: The Seven Detections ── */}
      <section id="detections" className="w-full max-w-7xl mx-auto px-6 py-24 border-t border-border/40 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] font-fira-mono font-bold tracking-widest text-primary uppercase block mb-3">CONTINUOUS MONITORING</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">The Seven Frozen MVP Detections</h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Veylo evaluates traffic metadata against seven built-in rules to flags threats without inspecting private data payloads.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            { id: "01", title: "Traffic Spike", desc: "Abnormal requests density from single node" },
            { id: "02", title: "Brute-Force Behaviour", desc: "Rapid authentication failures" },
            { id: "03", title: "Resource Enumeration", desc: "Fast scanning of file or directory endpoints" },
            { id: "04", title: "Restricted Destination", desc: "Attempts to ping restricted lists or networks" },
            { id: "05", title: "Rapid IP Change", desc: "Session IP changes outside geolocation profiles" },
            { id: "06", title: "Port Scan Pattern", desc: "Sequential port pings from a single client IP" },
            { id: "07", title: "Repeated Access Denial", desc: "Consistently failing RLS checks" },
          ].map((item) => (
            <div key={item.id} className="p-5 bg-card border border-border rounded-xl text-left hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-2.5">
              <span className="font-fira-mono font-bold text-primary text-xs tracking-wider">DETECTION {item.id}</span>
              <h3 className="font-bold text-sm leading-tight">{item.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 05: Cryptographic Forensic Ledger ── */}
      <section id="forensics" className="w-full max-w-7xl mx-auto px-6 py-24 border-t border-border/40 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="flex-1 flex flex-col items-start gap-6 text-left">
            <span className="text-[11px] font-fira-mono font-bold tracking-widest text-primary uppercase block">FORENSIC LEDGER</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Tamper-Evident SHA-256 Timeline</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Every verification attempt, device state change, and policy challenge is hashed into an append-only cryptographic ledger. Audit logs are historically immutable, guarded by strict PostgreSQL trigger constraints.
            </p>
          </div>

          <div className="flex-1 w-full max-w-md bg-card border border-border rounded-2xl p-6 relative flex flex-col gap-4 font-fira-mono text-xs select-none">
            <div className="absolute top-3 right-3 text-muted-foreground/60 flex items-center gap-1 font-sans">
              <IconTerminal size={12} />
              <span>append_only_ledger</span>
            </div>
            
            {[
              { time: "10:02:11", event: "MFA Token verified", hash: "sha256: 8a4f913d..." },
              { time: "10:04:32", event: "OS posture check passed", hash: "sha256: 3c9e2b1f..." },
              { time: "10:07:08", event: "Restricted outbound blocked", hash: "sha256: f1e2d3c4...", active: true },
            ].map((item) => (
              <div
                key={item.time}
                className={`p-3.5 border rounded-lg flex justify-between items-center ${
                  item.active 
                    ? "bg-status-critical-bg border-status-critical-text/40 text-status-critical-text" 
                    : "bg-background border-border text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-bold opacity-80">{item.time}</span>
                  <span className="font-sans font-semibold">{item.event}</span>
                </div>
                <span className="opacity-60">{item.hash}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 06: Pricing ── */}
      <section id="pricing" className="w-full max-w-7xl mx-auto px-6 py-24 border-t border-border/40 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[11px] font-fira-mono font-bold tracking-widest text-primary uppercase block mb-3">PLAN TIERING</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Flexible, Multi-Tenant Tiers</h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Get started with our standard developer free trial or scale up to advanced forensic threat hunting for enterprise infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: "Free Trial",
              price: "0",
              users: "5 users maximum",
              features: ["Zero Trust Dashboard", "Manual Telemetry Simulation", "Standard Security Policies", "Basic Audit Ledger"],
            },
            {
              name: "Pro Plan",
              price: "49",
              users: "Up to 50 users",
              featured: true,
              features: ["Zero Trust Dashboard", "Manual Telemetry Simulation", "Unlimited Security Policies", "SHA-256 Ledger Verification", "PhonePe API Payment Flow"],
            },
            {
              name: "Enterprise Custom",
              price: "250",
              users: "1000+ users capacity",
              features: ["Zero Trust Dashboard", "Manual Telemetry Simulation", "Custom Concentric Rules", "Immutable Hash Chain Trigger", "PhonePe API Payment Flow", "24/7 Security SLA Support"],
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`p-8 bg-card border rounded-2xl text-left flex flex-col gap-6 relative transition-all duration-300 hover:shadow-lg ${
                plan.featured ? "border-primary shadow-lg ring-1 ring-primary" : "border-border"
              }`}
            >
              {plan.featured && (
                <span className="absolute top-0 -translate-y-1/2 left-8 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              )}
              <div>
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <span className="text-muted-foreground text-xs leading-relaxed">{plan.users}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight">${plan.price}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <div className="h-px bg-border/60" />
              <ul className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`w-full py-2.5 text-center text-xs font-bold rounded-lg transition-all ${
                  plan.featured
                    ? "bg-primary text-primary-foreground hover:bg-accent hover:text-black shadow-md"
                    : "border border-border hover:bg-muted/10"
                }`}
              >
                Choose Plan
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 07: Final CTA ── */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-24 border-t border-border/40 bg-card/10 z-10 flex flex-col items-center gap-6">
        <CornerPlus className="left-0 top-0 -translate-x-1/2 -translate-y-1/2" />
        <CornerPlus className="right-0 top-0 translate-x-1/2 -translate-y-1/2" />
        <CornerPlus className="left-0 bottom-0 -translate-x-1/2 translate-y-1/2" />
        <CornerPlus className="right-0 bottom-0 translate-x-1/2 translate-y-1/2" />

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-center leading-tight">
          Security should not trust once. <br />
          <span className="text-primary">It should verify continuously.</span>
        </h2>
        
        <p className="text-muted-foreground text-center max-w-md text-sm leading-relaxed">
          Start protecting your organization access layers and network transactions with Concentric Zero Trust.
        </p>

        <div className="flex items-center gap-4 pt-2">
          <Link
            to="/register"
            className="px-6 py-3 text-sm font-bold text-primary-foreground bg-primary hover:bg-accent hover:text-black rounded-lg transition-all flex items-center gap-1.5"
          >
            Start Free Trial
            <IconChevronRight size={14} />
          </Link>
          <Link
            to="/login"
            className="px-6 py-3 text-sm font-semibold border border-border bg-card/40 hover:bg-muted/10 rounded-lg transition-all"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-border/40 py-10 z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-fira-mono text-muted-foreground">
          <span>© 2026 VEYLO INC. ALL RIGHTS RESERVED.</span>
          <span className="tracking-widest">VERIFY EVERY LAYER.</span>
        </div>
      </footer>
    </div>
  );
}
