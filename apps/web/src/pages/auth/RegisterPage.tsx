import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconShieldLock,
} from "@tabler/icons-react";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { Project } from "@veylo/shared";

type RegisterStep = 1 | 2 | 3 | 4;

interface AdminFormData {
  display_name: string;
  email: string;
  password: string;
}

interface ProjectFormData {
  name: string;
  slug: string;
  description: string;
}

const STEP_LABELS = [
  "Account",
  "Project",
  "Subscription",
  "Activate",
];

function StepIndicator({ current }: { current: RegisterStep }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as RegisterStep;
        const done = current > step;
        const active = current === step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/10"
                      : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {done ? <IconCheck size={14} stroke={3} /> : step}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`flex-1 h-[1.5px] max-w-[40px] -translate-y-3 transition-colors duration-200 ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PasswordStrength({ password }: { password?: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const score = checks.filter(Boolean).length;
  let text = "Too weak";
  let color = "rgb(239, 68, 68)";

  if (score >= 5) {
    text = "Strong (Thesis-grade)";
    color = "rgb(16, 185, 129)";
  } else if (score >= 3) {
    text = "Medium";
    color = "rgb(245, 158, 11)";
  }

  return (
    <div className="mt-2 text-left">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className="flex-1 h-1 transition-colors duration-200"
            style={{
              backgroundColor: level <= score ? color : "var(--color-border)",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
        <span>Security check</span>
        <span className="font-bold" style={{ color }}>{text}</span>
      </div>
    </div>
  );
}

function Step1Account({ data, onChange, onNext }: Step1Props) {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<any>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      useAuthStore.getState().setSession(response);
      onNext();
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-left">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-1">Create your admin account</h2>
        <p className="text-xs text-muted-foreground">Set up the credentials for your telemetry dashboard.</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Full Name</label>
        <input
          type="text"
          required
          value={data.display_name}
          onChange={(e) => onChange({ ...data, display_name: e.target.value })}
          placeholder="Acme Admin"
          className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Email Address</label>
        <input
          type="email"
          required
          value={data.email}
          onChange={(e) => onChange({ ...data, email: e.target.value })}
          placeholder="admin@acme.com"
          className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Password (min 12 chars)</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            required
            value={data.password}
            onChange={(e) => onChange({ ...data, password: e.target.value })}
            placeholder="••••••••••••"
            className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-4 pr-10 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
        <PasswordStrength password={data.password} />
      </div>

      {error && (
        <div className="p-3 bg-status-critical-bg border border-status-critical-text/30 text-status-critical-text text-xs rounded-lg font-medium text-left">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !data.display_name || !data.email || !data.password}
        className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50 text-xs uppercase tracking-wider mt-3"
      >
        {loading ? "Creating account…" : "Continue"}
      </button>
    </form>
  );
}

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Step3Project({ data, onChange, onNext }: Step3Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const project = await apiRequest<Project>("/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      onNext(project);
    } catch (err: any) {
      setError(err.message || "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-left">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-1">Create your first project</h2>
        <p className="text-xs text-muted-foreground">
          Projects contain your security boundaries, devices, policy engines, and audit logs.
        </p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Project Name</label>
        <input
          type="text"
          required
          value={data.name}
          onChange={(e) => {
            const name = e.target.value;
            onChange({ ...data, name, slug: deriveSlug(name) });
          }}
          placeholder="Acme Workspace"
          className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">URL Slug</label>
        <div className="flex items-center">
          <span className="bg-muted text-muted-foreground border border-border border-r-0 rounded-l-lg py-2.5 px-3 font-mono text-sm select-none">
            veylo.io/
          </span>
          <input
            type="text"
            required
            value={data.slug}
            onChange={(e) => onChange({ ...data, slug: deriveSlug(e.target.value) })}
            className="w-full bg-background border border-border text-foreground rounded-r-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Description (Optional)</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Describe your telemetry pipeline..."
          className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all h-20 resize-none"
        />
      </div>

      {error && (
        <div className="p-3 bg-status-critical-bg border border-status-critical-text/30 text-status-critical-text text-xs rounded-lg font-medium text-left">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-2">
        <button
          type="submit"
          disabled={loading || !data.name || !data.slug}
          className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50 text-xs uppercase tracking-wider"
        >
          {loading ? "Creating project…" : "Continue"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="w-full bg-transparent border border-border hover:bg-muted/10 text-foreground font-semibold py-2.5 rounded-lg transition-all cursor-pointer text-xs uppercase tracking-wider"
        >
          Skip Project Setup
        </button>
      </div>
    </form>
  );
}

const PLANS = [
  { id: "free", name: "Free Tier", price: "$0", desc: "Up to 5 collaborators, standard telemetry", badge: "Default" },
  { id: "pro", name: "Pro Plan", price: "$49", desc: "Up to 50 collaborators, unlimited policies & rules", badge: "Popular" },
  { id: "enterprise", name: "Enterprise Custom", price: "$250", desc: "SSO, cryptographic forensics, premium support" },
];

function Step4Subscription({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState("free");

  return (
    <div className="flex flex-col gap-4">
      <div className="text-left">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-1">Choose subscription tier</h2>
        <p className="text-xs text-muted-foreground">Choose a level of protection scaled to your deployment footprint.</p>
      </div>

      <div className="flex flex-col gap-2.5 text-left">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelected(plan.id)}
            className={`w-full flex items-center justify-between p-4 bg-background border rounded-xl cursor-pointer transition-all ${
              selected === plan.id 
                ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                : "border-border hover:border-border-hover"
            }`}
          >
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{plan.name}</span>
                {plan.badge && (
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{plan.desc}</p>
            </div>
            <span className="font-extrabold text-sm text-foreground">{plan.price}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md text-xs uppercase tracking-wider mt-3"
      >
        Subscribe & Next
      </button>
    </div>
  );
}

function Step5Activate({ project }: { project: Project }) {
  const navigate = useNavigate();
  const setProject = useAuthStore((s) => s.setProject);

  function handleActivate() {
    setProject(project);
    navigate("/dashboard");
  }

  return (
    <div className="text-center flex flex-col items-center gap-5 py-4">
      <div className="w-14 h-14 rounded-full bg-status-low-bg text-status-low-text flex items-center justify-center shadow-lg shadow-status-low-text/10">
        <IconCheck size={32} stroke={2.5} />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-1">{project.name} is ready!</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your telemetry project is active. Let's get you set up — onboard your devices, add protected resources, and configure your Zero Trust security policies.
        </p>
      </div>
      <button
        type="button"
        onClick={handleActivate}
        className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md text-xs uppercase tracking-wider"
      >
        Go to dashboard
      </button>
    </div>
  );
}

interface Step1Props {
  data: AdminFormData;
  onChange: (d: AdminFormData) => void;
  onNext: () => void;
}

interface Step3Props {
  data: ProjectFormData;
  onChange: (d: ProjectFormData) => void;
  onNext: (project: Project) => void;
}

export default function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>(1);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  const [adminData, setAdminData] = useState<AdminFormData>({
    display_name: "",
    email: "",
    password: "",
  });

  const [projectData, setProjectData] = useState<ProjectFormData>({
    name: "",
    slug: "",
    description: "",
  });

  return (
    <>
      <title>Create your project — Veylo</title>

      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 relative overflow-hidden flex-col gap-6">
        {/* Background glowing effects */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

        {/* Wordmark logo */}
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg shadow-md shadow-primary/10">
            <IconShieldLock size={18} stroke={2.5} />
          </div>
          <span className="font-fira-mono font-bold tracking-tight text-base uppercase">Veylo</span>
        </Link>

        {/* Form Container Card */}
        <div className="w-full max-w-[460px] bg-card border border-border shadow-2xl rounded-2xl p-8 relative z-10">
          <StepIndicator current={step} />

          {step === 1 && (
            <Step1Account
              data={adminData}
              onChange={setAdminData}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step3Project
              data={projectData}
              onChange={setProjectData}
              onNext={(proj) => {
                setCreatedProject(proj);
                setStep(3);
              }}
            />
          )}
          {step === 3 && <Step4Subscription onNext={() => setStep(4)} />}
          {step === 4 && createdProject && (
            <Step5Activate
              project={createdProject}
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground relative z-10 mt-2">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline hover:text-accent font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}
