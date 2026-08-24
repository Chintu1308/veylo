import {
  IconLock,
  IconMail,
  IconShieldLock,
} from "@tabler/icons-react";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { LoginResponse } from "@veylo/shared";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setProject = useAuthStore((s) => s.setProject);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      setSession(response);

      // Fetch user's projects to auto-select the active project
      const projects = await apiRequest<any[]>("/projects", {
        headers: { Authorization: `Bearer ${response.access_token}` },
      });

      if (projects && projects.length > 0) {
        setProject(projects[0]);
      }

      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setIsLoading(true);
    setError(null);

    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[420px] bg-card border border-border shadow-2xl rounded-2xl p-8 relative z-10">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8">
          <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-lg shadow-md shadow-primary/10">
            <IconShieldLock size={22} stroke={2.5} />
          </div>
          <div>
            <div className="font-fira-mono font-bold tracking-tight text-lg uppercase">Veylo</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase leading-none font-medium mt-0.5">
              Zero Trust Telemetry
            </div>
          </div>
        </div>

        {isForgotMode ? (
          /* Forgot Password Interface */
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground mb-1.5">Reset Password</h1>
              <p className="text-xs text-muted-foreground">
                Enter your email address to receive a recovery link.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 bg-status-low-bg border border-status-low-text/30 text-status-low-text text-xs rounded-lg leading-relaxed">
                If an eligible account exists with that email, a password recovery link has been sent.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <IconMail
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50 text-xs uppercase tracking-wider mt-2"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setIsForgotMode(false);
                setForgotSuccess(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline tracking-wide text-left cursor-pointer transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* Login Form */
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground mb-1.5">Sign In</h1>
              <p className="text-xs text-muted-foreground">
                Enter your credentials to access your telemetry projects.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-status-critical-bg border border-status-critical-text/30 text-status-critical-text text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            {/* Email input */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <IconMail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Password input */}
            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotMode(true)}
                  className="text-[10px] font-bold tracking-wider text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <IconLock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50 text-xs uppercase tracking-wider mt-3"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>

            <div className="text-xs text-muted-foreground text-center mt-2.5">
              Don't have a project?{" "}
              <Link
                to="/register"
                className="text-primary hover:underline hover:text-accent font-semibold transition-colors"
              >
                Create one
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
