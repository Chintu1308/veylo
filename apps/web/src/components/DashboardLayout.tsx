import {
  IconCode,
  IconLayoutDashboard,
  IconLogout,
  IconPlus,
  IconShieldLock,
  IconTimeline,
  IconUsers,
  IconX,
  IconDevices,
} from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiRequest } from "../lib/api";
import type { Project } from "@veylo/shared";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, selectedProject, setProject } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [userIp, setUserIp] = useState("Loading IP...");

  const user = session?.user;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function fetchProjects() {
    if (!session?.access_token) return;
    setLoadingProjects(true);
    try {
      const data = await apiRequest<Project[]>("/projects", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setProjects(data);
      if (!selectedProject && data.length > 0) {
        setProject(data[0]);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, [session?.access_token]);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setUserIp(data.ip))
      .catch(() => setUserIp("127.0.0.1"));
  }, []);

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !newProjectName) return;
    setCreating(true);
    setCreateError(null);

    const slug = generateSlug(newProjectName);
    if (!slug) {
      setCreateError("Invalid project name (letters, numbers and spaces only).");
      setCreating(false);
      return;
    }

    try {
      const newProj = await apiRequest<Project>("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProjectName,
          slug,
          description: newProjectDesc || undefined,
        }),
      });

      setProjects((prev) => [...prev, newProj]);
      setShowCreateModal(false);
      setNewProjectName("");
      setNewProjectDesc("");
      navigate(`/${newProj.slug}`);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  const currentSlug = selectedProject?.slug || "dashboard";
  
  const menuItems = [
    {
      path: `/${currentSlug}`,
      label: "Overview",
      icon: <IconLayoutDashboard size={18} stroke={2} />,
    },
    {
      path: `/${currentSlug}/members`,
      label: "Collaborators",
      icon: <IconUsers size={18} stroke={2} />,
    },
    {
      path: `/${currentSlug}/devices`,
      label: "Devices",
      icon: <IconDevices size={18} stroke={2} />,
    },
    {
      path: `/${currentSlug}/settings`,
      label: "Settings",
      icon: <IconCode size={18} stroke={2} />,
    },
    {
      path: `/${currentSlug}/audit-logs`,
      label: "Audit Logs",
      icon: <IconTimeline size={18} stroke={2} />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border/80 flex flex-col sticky top-0 h-screen select-none shrink-0 z-30">
        
        {/* Logo Section */}
        <div className="px-6 py-4 border-b border-border/80 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg shadow-md shadow-primary/5">
            <IconShieldLock size={18} stroke={2.5} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-fira-mono font-bold tracking-tight text-base uppercase">Veylo</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-muted border border-border text-muted-foreground rounded uppercase">
              ADMIN
            </span>
          </div>
        </div>

        {/* Selected Project Switcher */}
        <div className="p-4 border-b border-border/80 bg-background/50">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              Active Project
            </label>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              title="Create New Project"
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5"
            >
              <IconPlus size={14} />
            </button>
          </div>
          
          {loadingProjects ? (
            <div className="text-xs text-muted-foreground py-1">Loading projects...</div>
          ) : projects.length > 0 ? (
            <select
              value={selectedProject?.id ?? ""}
              onChange={(e) => {
                const proj = projects.find((p) => p.id === e.target.value);
                if (proj) {
                  // Navigate to the new project's slug, replacing the current slug in the URL
                  const currentPath = location.pathname;
                  const newPath = currentPath.replace(`/${currentSlug}`, `/${proj.slug}`);
                  navigate(newPath);
                }
              }}
              className="w-full bg-card border border-border text-foreground rounded-lg py-1.5 px-3 font-mono text-xs focus:outline-none focus:border-primary cursor-pointer transition-all"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">No active project</div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-primary hover:bg-accent hover:text-black text-primary-foreground text-xs font-bold py-1.5 rounded-lg cursor-pointer transition-all uppercase tracking-wider"
              >
                + Create Project
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom User Profile */}
        <div className="p-4 border-t border-border/80 flex flex-col gap-3">
          {user && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {(user.display_name ?? user.email).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="font-bold text-xs text-foreground truncate">
                  {user.display_name ?? "User Account"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                  {user.email}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2 border border-border hover:bg-status-critical-bg hover:text-status-critical-text rounded-lg text-xs font-bold text-muted-foreground cursor-pointer transition-all uppercase tracking-wider"
          >
            <IconLogout size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-14 bg-card border-b border-border/80 flex items-center justify-end px-8 sticky top-0 z-20 shadow-sm">
          {user && (
            <div className="flex items-center gap-3.5">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded uppercase">
                {user.role.replace("_", " ")}
              </span>
              <div className="w-[1px] h-4 bg-border/80" />
              <span className="text-xs font-semibold text-muted-foreground font-mono">
                IP: {userIp}
              </span>
            </div>
          )}
        </header>

        {/* Content Container */}
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto box-border overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[420px] bg-card border border-border shadow-2xl rounded-2xl p-6 relative animate-in zoom-in-95 duration-100 text-left">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold tracking-tight text-foreground">New Project</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Core Service Api"
                  required
                  className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Continuous Zero Trust boundary validation"
                  rows={3}
                  className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              {createError && (
                <p className="text-xs text-status-critical-text font-medium leading-relaxed">
                  {createError}
                </p>
              )}

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border hover:bg-muted/10 text-foreground font-semibold rounded-lg text-xs cursor-pointer transition-all uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName}
                  className="px-4 py-2 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
