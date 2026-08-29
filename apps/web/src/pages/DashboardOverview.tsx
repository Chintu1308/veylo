import {
  IconActivity,
  IconAlertTriangle,
  IconCpu,
  IconUsers,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";

interface LiveStats {
  collaborators: number;
  devices: number;
  alerts: number;
  forensics: number;
}

export default function DashboardOverview() {
  const { session, selectedProject } = useAuthStore();
  const [stats, setStats] = useState<LiveStats>({
    collaborators: 0,
    devices: 0,
    alerts: 0,
    forensics: 0,
  });
  const [loading, setLoading] = useState(true);
  const projectId = selectedProject?.id;
  const token = session?.access_token;

  async function fetchLiveStats() {
    if (!projectId || !token) return;
    setLoading(true);
    try {
      // Fetch data in parallel
      const [members, devices, alerts, forensics] = await Promise.all([
        apiRequest<any[]>(`/projects/${projectId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiRequest<any[]>(`/projects/${projectId}/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiRequest<any[]>(`/projects/${projectId}/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiRequest<any[]>(`/projects/${projectId}/forensics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats({
        collaborators: members.length,
        devices: devices.length,
        alerts: alerts.filter((a) => a.status === "active").length,
        forensics: forensics.length,
      });
    } catch (err) {
      console.error("Failed to fetch dashboard live stats:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLiveStats();
  }, [projectId, token]);

  const statCards = [
    {
      label: "Total Collaborators",
      value: loading ? "..." : stats.collaborators.toString(),
      icon: <IconUsers size={20} className="text-primary" />,
      desc: "Users with project privileges",
    },
    {
      label: "Registered Devices",
      value: loading ? "..." : stats.devices.toString(),
      icon: <IconCpu size={20} className="text-primary" />,
      desc: "Validated endpoints active",
    },
    {
      label: "Active Alerts",
      value: loading ? "..." : stats.alerts.toString(),
      icon: <IconAlertTriangle size={20} className="text-primary" />,
      desc: "Outstanding threat notifications",
    },
    {
      label: "Forensic Ledger",
      value: loading ? "..." : stats.forensics.toString(),
      icon: <IconActivity size={20} className="text-primary" />,
      desc: "Cryptographically verified events",
    },
  ];

  return (
    <div className="flex flex-col gap-8 text-left">
      {/* Title section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Manage your telemetry project access, collaborators, security posture, and audit logs.
        </p>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border p-6 rounded-xl hover:shadow-md hover:border-primary/40 transition-all duration-200"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                {stat.label}
              </span>
              <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-lg">
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-foreground font-fira-mono mb-1">
              {stat.value}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">
              {stat.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Two Columns: Live Telemetry Status & Main Isolation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Live Status Console */}
        <div className="bg-card border border-border p-8 rounded-2xl flex flex-col gap-6">
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Live Telemetry Status
            </h2>
            <p className="text-xs text-muted-foreground">
              Veylo is currently listening for incoming device posture events, network flows, and forensic ledger updates.
            </p>
          </div>

          <div className="bg-background border border-border rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-center h-full min-h-[200px]">
             <div className="spinner mb-2 opacity-50" />
             <h3 className="font-bold text-foreground text-sm">Waiting for live data...</h3>
             <p className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">
               Go to the <strong>Devices</strong> tab to onboard your first machine and start streaming real-time security events.
             </p>
          </div>
        </div>

        {/* Main Info Card */}
        <div className="bg-card border border-border p-8 rounded-2xl flex flex-col justify-between gap-6">
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">
              Zero Trust Project Isolation Active
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This project (
              <strong className="text-foreground">{selectedProject?.name ?? "your project"}</strong>)
              is protected with dynamic database-level constraints. Access permissions are verified
              real-time against project collaborator records, preventing any unauthorized cross-project access.
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            {[
              "Project isolation confirmed",
              "Audit logging enabled",
              "Zero Trust policy engine verified",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-status-low-bg text-status-low-text flex items-center justify-center shrink-0">
                  <IconShieldCheck size={12} stroke={3} />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
