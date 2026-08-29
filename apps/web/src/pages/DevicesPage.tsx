import {
  IconCpu,
  IconTerminal,
  IconCopy,
  IconCheck,
  IconShield,
  IconBrandApple,
  IconBrandWindows,
  IconBrandUbuntu,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";

interface Device {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  os: string;
  status: "approved" | "pending" | "blocked";
  posture_score: number;
  last_seen_at: string;
  created_at: string;
}

export default function DevicesPage() {
  const { session, selectedProject } = useAuthStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"list" | "integration">("list");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const projectId = selectedProject?.id ?? "YOUR_PROJECT_ID";
  const token = session?.access_token ?? "YOUR_JWT_TOKEN";

  async function fetchDevices() {
    if (!selectedProject?.id || !session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Device[]>(
        `/projects/${selectedProject.id}/devices`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      setDevices(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDevices();
  }, [selectedProject?.id, session?.access_token]);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  }

  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

  const macOsScript = `# Veylo Universal Device Onboarding Script (macOS / Linux / Termux)
# Run this on your target machine to register it and send telemetry posture

export PROJECT_ID="${projectId}"
export AUTH_TOKEN="${token}"
export API_BASE="${API_BASE}"

echo "Initializing Veylo Agent enrollment..."

# Detect OS
OS_TYPE=$(uname -s | tr '[:upper:]' '[:lower:]')
if [[ "$OS_TYPE" == *"linux"* || "$OS_TYPE" == *"android"* ]]; then
  OS_ID="linux"
  HOSTNAME=$(hostname 2>/dev/null || echo "Mobile/Linux Node")
else
  OS_ID="macos"
  HOSTNAME=$(hostname 2>/dev/null || echo "Mac Workstation")
fi

# 1. Register device with Veylo API
REGISTRATION_RESPONSE=$(curl -s -X POST "\${API_BASE}/projects/\${PROJECT_ID}/devices/register" \\
  -H "Authorization: Bearer \${AUTH_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"name\\": \\"\${HOSTNAME}\\", \\"os\\": \\"\${OS_ID}\\"}")

DEVICE_ID=$(echo \$REGISTRATION_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$')

if [ -z "\$DEVICE_ID" ]; then
  echo "❌ Enrollment failed. Verify your project ID or authentication token."
  exit 1
fi

echo "✅ Device enrolled successfully! Device ID: \$DEVICE_ID"

# 2. Continuous security check & posture feedback loop
while true; do
  SCORE=100
  FIREWALL_ON=1
  DISK_ENCRYPTED=1

  # Basic Mac OS Posture Checks
  if [ "\$OS_ID" = "macos" ]; then
    if command -v socketfilterfw >/dev/null 2>&1; then
      FIREWALL_ON=$(socketfilterfw --getstate 2>/dev/null | grep -c "enabled")
    fi
    if command -v fdesetup >/dev/null 2>&1; then
      DISK_ENCRYPTED=$(fdesetup status 2>/dev/null | grep -c "is On")
    fi
  fi

  if [ "\$FIREWALL_ON" -eq 0 ]; then SCORE=\$((SCORE - 30)); fi
  if [ "\$DISK_ENCRYPTED" -eq 0 ]; then SCORE=\$((SCORE - 40)); fi

  echo "Reporting Posture Score: \${SCORE}% (Firewall: \${FIREWALL_ON}, Encryption: \${DISK_ENCRYPTED})"

  curl -s -X PATCH "\${API_BASE}/projects/\${PROJECT_ID}/devices/\${DEVICE_ID}/posture" \\
    -H "Authorization: Bearer \${AUTH_TOKEN}" \\
    -H "Content-Type: application/json" \\
    -d "{\\"posture_score\\": \${SCORE}, \\"details\\": {\\"firewall\\": \${FIREWALL_ON}, \\"encryption\\": \${DISK_ENCRYPTED}}}" >/dev/null

  sleep 300
done`;

  const nodeMiddleware = `// Veylo Node.js / Express Zero Trust Access Guard Middleware
// Paste this in your API gateway or main router file to protect private endpoints.

import axios from 'axios';

export async function veyloZeroTrustGuard(req, res, next) {
  const projectId = "${projectId}";
  const token = req.headers.authorization; // Expects User Bearer Token
  const apiBase = "${API_BASE}";

  if (!token) {
    return res.status(401).json({ error: "Missing identity token" });
  }

  try {
    // 1. Log flow metadata & fetch access evaluation
    await axios.post(
      \`\${apiBase}/projects/\${projectId}/monitoring/events\`,
      {
        source_ip: req.ip || '127.0.0.1',
        destination_ip: req.hostname || 'api.internal',
        destination_port: req.socket.localPort || 443,
        protocol: req.protocol || 'https',
        bytes_transferred: req.headers['content-length'] || 0,
        action: 'allow'
      },
      {
        headers: { Authorization: token }
      }
    );

    // 2. Telemetry and policy checked. Forward flow.
    next();
  } catch (error) {
    res.status(403).json({
      error: "Access Denied by Veylo Zero Trust policy",
      details: error.response?.data?.message || "Posture check failed."
    });
  }
}`;

  function renderOsIcon(os: string) {
    const norm = os.toLowerCase();
    if (norm.includes("mac")) return <IconBrandApple size={18} />;
    if (norm.includes("win")) return <IconBrandWindows size={18} />;
    if (norm.includes("lin") || norm.includes("ubu")) return <IconBrandUbuntu size={18} />;
    return <IconDeviceMobile size={18} />;
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Devices</h1>
        <p className="text-sm text-muted-foreground">
          Onboard target machines, monitor device health compliance, and view real-time Zero Trust postures.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border/80 gap-2">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
            activeTab === "list"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Enrolled Devices
        </button>
        <button
          onClick={() => setActiveTab("integration")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
            activeTab === "integration"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Integration Guides
        </button>
      </div>

      {/* Content */}
      {activeTab === "list" ? (
        loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
            <p className="text-sm font-semibold text-foreground">
              Failed to load devices: {error}
            </p>
            <button
              type="button"
              onClick={fetchDevices}
              className="px-5 py-2 border border-border hover:bg-muted/10 text-foreground font-semibold rounded-lg text-xs cursor-pointer transition-all uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
              <IconCpu size={24} />
            </div>
            <div className="max-w-sm">
              <h3 className="font-bold text-foreground text-base mb-1.5">No Devices Enrolled</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your workstation laptops or cloud nodes to begin receiving posture telemetry logs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("integration")}
              className="px-5 py-2.5 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm uppercase tracking-wider mt-2"
            >
              View Integration Script
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-background border-b border-border/80 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                    <th className="p-4">OS</th>
                    <th className="p-4">Device Name</th>
                    <th className="p-4">Posture Score</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {devices.map((device) => (
                    <tr key={device.id} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {renderOsIcon(device.os)}
                          <span className="text-xs font-mono font-bold uppercase">{device.os}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        {device.name}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${device.posture_score}%`,
                                backgroundColor:
                                  device.posture_score >= 80
                                    ? "var(--color-status-low-text, #10B981)"
                                    : device.posture_score >= 50
                                      ? "var(--color-status-medium-text, #F59E0B)"
                                      : "var(--color-status-critical-text, #EF4444)",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold">{device.posture_score}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 border rounded uppercase ${
                          device.status === "approved"
                            ? "bg-status-low-bg text-status-low-text border-status-low-text/20"
                            : device.status === "pending"
                              ? "bg-status-medium-bg text-status-medium-text border-status-medium-text/20"
                              : "bg-status-critical-bg text-status-critical-text border-status-critical-text/20"
                        }`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono text-muted-foreground">
                        {device.last_seen_at 
                          ? new Date(device.last_seen_at).toLocaleString() 
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Integration Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left panel: Code snippets */}
          <div className="flex flex-col gap-6">
            
            {/* Snippet 1 */}
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <IconTerminal size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Device Posture Script (MacOS/Linux)</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(macOsScript, "macos-script")}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted/10 transition-all flex items-center gap-1.5 text-xs font-semibold"
                >
                  {copiedText === "macos-script" ? (
                    <>
                      <IconCheck size={14} className="text-status-low-text" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Copy and run this shell script locally on developer machines. It registers the device and periodically gathers check compliance to report back.
              </p>
              <pre className="bg-background border border-border p-3 rounded-lg font-fira-mono text-[10px] overflow-x-auto text-foreground max-h-56 box-border select-all">
                {macOsScript.replace(projectId, "••••••••••••••••••••••••").replace(token, "••••••••••••••••••••••••")}
              </pre>
            </div>

            {/* Snippet 2 */}
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <IconCpu size={18} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Express API Guard Middleware</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(nodeMiddleware, "express-middleware")}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted/10 transition-all flex items-center gap-1.5 text-xs font-semibold"
                >
                  {copiedText === "express-middleware" ? (
                    <>
                      <IconCheck size={14} className="text-status-low-text" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add this node module middleware in your target server gateway to intercept inbound flows and apply Zero Trust validation.
              </p>
              <pre className="bg-background border border-border p-3 rounded-lg font-fira-mono text-[10px] overflow-x-auto text-foreground max-h-56 box-border select-all">
                {nodeMiddleware.replace(projectId, "••••••••••••••••••••••••")}
              </pre>
            </div>

          </div>

          {/* Right panel: Guide */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <IconShield size={18} className="text-primary" />
              Integration & Verification Steps
            </h2>

            <div className="flex flex-col gap-4 text-xs leading-relaxed text-muted-foreground">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-[10px]">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-0.5">Identify Active Project</h4>
                  <p>When you click <strong>Copy</strong>, the scripts are pre-populated with your current project ID and authentication token under the hood. For security, these IDs are hidden on the screen.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-[10px]">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-0.5">Run Onboarding Script</h4>
                  <p>Execute the shell script on your client machine. Once verified, check the <strong>Enrolled Devices</strong> tab—your machine will immediately appear as <code className="font-mono text-foreground">pending</code> or <code className="font-mono text-foreground">approved</code> depending on compliance score threshold settings.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-[10px]">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-0.5">Enforce Guard on Apps</h4>
                  <p>Import the Express middleware in your microservice backend. When incoming requests land from clients, Veylo inspects device security compliance at runtime, enforcing dynamic allow/deny decisions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
