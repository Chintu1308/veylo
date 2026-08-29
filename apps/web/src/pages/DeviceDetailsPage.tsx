import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconCpu,
  IconShield,
  IconCheck,
  IconX,
  IconActivity,
} from "@tabler/icons-react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { Device } from "@veylo/shared";
import { io } from "socket.io-client";

export default function DeviceDetailsPage() {
  const { slug, deviceId } = useParams<{ slug: string; deviceId: string }>();
  const navigate = useNavigate();
  const { selectedProject } = useAuthStore();
  
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!selectedProject?.id || !deviceId) return;
    
    setLoading(true);
    
    Promise.all([
      apiRequest<Device[]>(`/projects/${selectedProject.id}/devices`),
      apiRequest<any[]>(`/projects/${selectedProject.id}/monitoring/events?deviceId=${deviceId}`)
    ])
    .then(([devices, networkEvents]) => {
      const found = devices.find(d => d.id === deviceId);
      if (found) {
        setDevice(found);
        setNewName(found.name);
      }
      setEvents(networkEvents);
    })
    .finally(() => setLoading(false));

    // Listen for realtime updates
    const socketUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";
    const socket = io(socketUrl);
    
    socket.on("connect", () => {
      socket.emit("joinProject", { projectId: selectedProject.id });
    });

    socket.on("device.updated", (updatedDevice: Device) => {
      if (updatedDevice.id === deviceId) {
        setDevice(updatedDevice);
      }
    });

    return () => {
      socket.emit("leaveProject", { projectId: selectedProject.id });
      socket.disconnect();
    };
  }, [selectedProject?.id, deviceId]);

  async function handleRename() {
    if (!selectedProject || !device) return;
    try {
      const updated = await apiRequest<Device>(`/projects/${selectedProject.id}/devices/${device.id}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      });
      setDevice(updated);
      setEditingName(false);
    } catch (err: any) {
      alert("Failed to rename: " + err.message);
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm font-mono">Loading device details...</div>;
  }

  if (!device) {
    return <div className="p-8 text-status-critical-text font-bold">Device not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Back Button */}
      <div>
        <button 
          onClick={() => navigate(`/${slug}/devices`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-mono text-xs font-bold uppercase tracking-wider"
        >
          <IconArrowLeft size={16} /> Back to Devices
        </button>
      </div>

      {/* Header Profile */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
            <IconCpu size={24} />
          </div>
          <div className="flex flex-col gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="bg-background border border-border rounded px-3 py-1 text-foreground text-xl font-bold focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button onClick={handleRename} className="p-1.5 bg-status-low-bg text-status-low-text rounded hover:opacity-80">
                  <IconCheck size={16} />
                </button>
                <button onClick={() => { setEditingName(false); setNewName(device.name); }} className="p-1.5 bg-muted text-muted-foreground rounded hover:opacity-80">
                  <IconX size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground m-0">{device.name}</h1>
                <button 
                  onClick={() => setEditingName(true)}
                  className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors tracking-widest bg-muted px-2 py-1 rounded"
                >
                  Rename
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span>ID: {device.id}</span>
              <span>OS: {device.os.toUpperCase()}</span>
              <span>Status: <span className="uppercase text-primary">{device.status}</span></span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Posture Score</div>
          <div className="text-3xl font-mono font-bold text-primary flex items-center gap-2">
            <IconShield size={24} /> {device.posture_score}%
          </div>
        </div>
      </div>

      {/* Network Traffic */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <IconActivity className="text-primary" size={20} /> Network Telemetry
        </h2>

        {events.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <IconActivity size={32} className="text-muted-foreground opacity-50" />
            <h3 className="text-sm font-bold text-foreground">No Network Activity</h3>
            <p className="text-xs text-muted-foreground max-w-sm">This device has not generated any network requests yet, or it hasn't matched a Zero Trust policy.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/80">
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time</th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Source IP</th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dest IP:Port</th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {events.map((e, idx) => (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 text-xs font-mono text-muted-foreground">{new Date(e.timestamp || e.created_at).toLocaleString()}</td>
                    <td className="p-4 text-xs font-mono text-foreground">{e.source_ip}</td>
                    <td className="p-4 text-xs font-mono text-foreground">{e.destination_ip}:{e.destination_port}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                        e.action === "allow" 
                          ? "bg-status-low-bg text-status-low-text" 
                          : "bg-status-critical-bg text-status-critical-text"
                      }`}>
                        {e.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
