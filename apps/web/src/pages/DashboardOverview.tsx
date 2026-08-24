import {
  IconActivity,
  IconAlertTriangle,
  IconCpu,
  IconFlame,
  IconPlayerPlay,
  IconTimeline,
  IconUsers,
  IconTerminal,
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
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Simulation states
  const [simulating, setSimulating] = useState<string | null>(null);

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

  function addLog(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    setSimulationLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 8)]);
  }

  // Simulation Triggers
  async function handleSimulateDevice() {
    if (!projectId || !token) return;
    setSimulating("device");
    try {
      const names = ["Endpoint macOS Server", "Bastion Host", "Analytics Pipeline iPad", "Zero Trust Proxy Host", "Admin Windows VM"];
      const OSs = ["macos", "linux", "ios", "windows", "linux"];
      const idx = Math.floor(Math.random() * names.length);

      const device = await apiRequest<any>(`/projects/${projectId}/devices/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${names[idx]} (Simulated)`,
          os: OSs[idx],
        }),
      });

      addLog(`Device registered: ${device.name} (${device.os.toUpperCase()})`);
      fetchLiveStats();
    } catch (err: any) {
      addLog(`❌ Device simulation failed: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  }

  async function handleSimulateNetworkEvent() {
    if (!projectId || !token) return;
    setSimulating("network");
    try {
      const ips = ["192.168.1.102", "10.0.4.15", "172.16.89.4", "45.79.112.5", "8.8.8.8"];
      const ports = [80, 443, 3306, 22, 5432];
      const actions = ["allow", "allow", "allow", "deny", "allow"];
      const idx = Math.floor(Math.random() * ips.length);

      await apiRequest<any>(`/projects/${projectId}/monitoring/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_ip: ips[idx],
          destination_ip: "10.0.0.1",
          destination_port: ports[idx],
          protocol: "tcp",
          bytes_transferred: Math.floor(Math.random() * 8000) + 200,
          action: actions[idx],
        }),
      });

      addLog(`Network traffic logged: ${ips[idx]} → port ${ports[idx]} [${actions[idx].toUpperCase()}]`);
      fetchLiveStats();
    } catch (err: any) {
      addLog(`❌ Network simulation failed: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  }

  async function handleTriggerAlert() {
    if (!projectId || !token) return;
    setSimulating("alert");
    try {
      const titles = ["Unauthorized SSH Access Attempt", "Traffic Volume Anomaly", "Brute-Force Connection Triggered", "Out-of-hours Admin Action"];
      const severities = ["high", "medium", "critical", "low"];
      const idx = Math.floor(Math.random() * titles.length);

      const alert = await apiRequest<any>(`/projects/${projectId}/incidents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: titles[idx],
          description: "Triggered from the simulated testing environment console.",
          severity: severities[idx],
        }),
      });

      addLog(`Alert generated: ${alert.title} [SEVERITY: ${alert.severity.toUpperCase()}]`);
      fetchLiveStats();
    } catch (err: any) {
      addLog(`❌ Alert simulation failed: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  }

  async function handleSimulateForensicEvent() {
    if (!projectId || !token) return;
    setSimulating("forensic");
    try {
      const resources = ["Auth Service Config", "Postgres Root Schema", "Mongo Events Log", "SSO Policy Manifest"];
      const idx = Math.floor(Math.random() * resources.length);

      await apiRequest<any>(`/projects/${projectId}/forensics/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_data: `Policy Update: ${resources[idx]} - posture_score_threshold updated to 60`,
        }),
      });

      addLog(`Forensic record chain hashed: Target "${resources[idx]}"`);
      fetchLiveStats();
    } catch (err: any) {
      addLog(`❌ Forensic simulation failed: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  }

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

      {/* Two Columns: Test Environment Console & Main Isolation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Interactive Simulation Environment Console */}
        <div className="bg-card border border-border p-8 rounded-2xl flex flex-col gap-6">
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Telemetry Simulation Console
            </h2>
            <p className="text-xs text-muted-foreground">
              Manually trigger events to populate telemetry charts, register virtual entities, and test posture rules.
            </p>
          </div>

          {/* Trigger Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSimulateDevice}
              disabled={!!simulating}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-muted border border-border text-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
            >
              <IconPlayerPlay size={14} />
              {simulating === "device" ? "Registering…" : "Register Device"}
            </button>

            <button
              type="button"
              onClick={handleSimulateNetworkEvent}
              disabled={!!simulating}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-muted border border-border text-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
            >
              <IconActivity size={14} />
              {simulating === "network" ? "Streaming…" : "Log Net Traffic"}
            </button>

            <button
              type="button"
              onClick={handleTriggerAlert}
              disabled={!!simulating}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-muted border border-border text-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
            >
              <IconFlame size={14} />
              {simulating === "alert" ? "Triggering…" : "Trigger Alert"}
            </button>

            <button
              type="button"
              onClick={handleSimulateForensicEvent}
              disabled={!!simulating}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-muted border border-border text-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50"
            >
              <IconTimeline size={14} />
              {simulating === "forensic" ? "Hashing…" : "Chain Forensic Event"}
            </button>
          </div>

          {/* Log Tail Feed */}
          <div className="bg-background border border-border rounded-lg p-4 font-fira-mono text-[11px] flex flex-col gap-2 max-h-48 overflow-y-auto box-border">
            <div className="text-muted-foreground flex items-center gap-1 font-bold mb-1 border-b border-border pb-1">
              <IconTerminal size={12} />
              <span>LIVE_CONSOLE_LOG_TAIL</span>
            </div>
            {simulationLogs.length === 0 ? (
              <div className="text-muted-foreground/60 italic py-1">
                Waiting for simulation actions...
              </div>
            ) : (
              simulationLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 border-l-2 pl-2 ${
                    log.includes("❌")
                      ? "border-status-critical-text text-status-critical-text bg-status-critical-bg/10"
                      : "border-primary/40 text-foreground"
                  }`}
                >
                  {log}
                </div>
              ))
            )}
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
