import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

interface NetworkEvent {
  device_id: string;
  source_ip: string;
  destination_ip: string;
  action: "allow" | "deny";
}

export default function PersonalAlerts() {
  const { session, selectedProject } = useAuthStore();
  const [alerts, setAlerts] = useState<string[]>([]);
  const [newAlert, setNewAlert] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activePopups, setActivePopups] = useState<{id: number, msg: string}[]>([]);

  // Load alerts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("veylo-personal-alerts");
    if (saved) {
      try {
        setAlerts(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save to localStorage when alerts change
  useEffect(() => {
    localStorage.setItem("veylo-personal-alerts", JSON.stringify(alerts));
  }, [alerts]);

  // Connect to socket to listen for matching traffic
  useEffect(() => {
    if (!selectedProject?.id || alerts.length === 0) return;

    const socketUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("joinProject", { projectId: selectedProject.id });
    });

    socket.on("network.event", (event: NetworkEvent) => {
      // Check if event matches any of our alerts
      const matched = alerts.find(a => 
        event.destination_ip.toLowerCase().includes(a.toLowerCase())
      );

      if (matched) {
        const popupId = Date.now() + Math.random();
        setActivePopups(prev => [
          ...prev, 
          { id: popupId, msg: `🚨 ALERT: Traffic detected to ${event.destination_ip}` }
        ]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setActivePopups(prev => prev.filter(p => p.id !== popupId));
        }, 5000);
      }
    });

    return () => {
      socket.emit("leaveProject", { projectId: selectedProject.id });
      socket.disconnect();
    };
  }, [selectedProject?.id, alerts]);

  const addAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAlert.trim() && !alerts.includes(newAlert.trim())) {
      setAlerts([...alerts, newAlert.trim()]);
      setNewAlert("");
    }
  };

  const removeAlert = (target: string) => {
    setAlerts(alerts.filter(a => a !== target));
  };

  if (!session) return null;

  return (
    <>
      {/* Floating Alert Popups */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
        {activePopups.map(popup => (
          <div key={popup.id} className="bg-status-critical-bg border border-status-critical-text text-status-critical-text px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-right font-bold text-sm pointer-events-auto">
            {popup.msg}
          </div>
        ))}
      </div>

      {/* Floating Configuration Button */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-card border border-border text-foreground hover:bg-accent px-4 py-2 rounded-full shadow-lg text-xs font-bold transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          My Alerts ({alerts.length})
        </button>

        {isOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-80 bg-card border border-border rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-sm font-bold text-foreground mb-1">Personal Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Get notified when traffic hits a specific IP or Domain. Only you will see these alerts.
            </p>
            
            <form onSubmit={addAlert} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newAlert}
                onChange={e => setNewAlert(e.target.value)}
                placeholder="e.g. netflix.com"
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/90 cursor-pointer">
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-2">No active alerts</div>
              )}
              {alerts.map(alert => (
                <div key={alert} className="flex items-center justify-between bg-background border border-border rounded px-2 py-1.5 text-xs">
                  <span className="text-foreground truncate">{alert}</span>
                  <button onClick={() => removeAlert(alert)} className="text-muted-foreground hover:text-status-critical-text cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
