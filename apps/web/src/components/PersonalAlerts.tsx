import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { apiRequest } from "../lib/api";

interface NetworkEvent {
  device_id: string;
  source_ip: string;
  destination_ip: string;
  action: "allow" | "deny";
}

interface PersonalAlert {
  id: string;
  matched_rule: string;
  destination_ip: string;
  created_at: string;
}

export default function PersonalAlerts() {
  const { session, selectedProject } = useAuthStore();
  const [alerts, setAlerts] = useState<string[]>([]);
  const [history, setHistory] = useState<PersonalAlert[]>([]);
  const [newAlert, setNewAlert] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [activePopups, setActivePopups] = useState<{id: number, msg: string}[]>([]);

  // Load rules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("veylo-personal-alerts");
    if (saved) {
      try { setAlerts(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Fetch history from Supabase
  useEffect(() => {
    if (isOpen && selectedProject?.id && activeTab === "history") {
      apiRequest<PersonalAlert[]>(`/projects/${selectedProject.id}/monitoring/personal-alerts`)
        .then(setHistory)
        .catch(console.error);
    }
  }, [isOpen, activeTab, selectedProject?.id]);

  useEffect(() => {
    localStorage.setItem("veylo-personal-alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    if (!selectedProject?.id || alerts.length === 0) return;

    const socketUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("joinProject", { projectId: selectedProject.id });
    });

    socket.on("network.event", (event: NetworkEvent) => {
      const matched = alerts.find(a => event.destination_ip.toLowerCase().includes(a.toLowerCase()));

      if (matched) {
        const popupId = Date.now() + Math.random();
        setActivePopups(prev => [...prev, { id: popupId, msg: `🚨 ALERT: Traffic to ${event.destination_ip}` }]);

        // Save to Supabase
        apiRequest(`/projects/${selectedProject.id}/monitoring/personal-alerts`, {
          method: "POST",
          body: JSON.stringify({
            matched_rule: matched,
            destination_ip: event.destination_ip,
            device_id: event.device_id
          })
        }).catch(console.error);

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

  const removeAlert = (target: string) => setAlerts(alerts.filter(a => a !== target));

  if (!session) return null;

  return (
    <>
      <div className="fixed bottom-20 right-6 z-[100] flex flex-col gap-3">
        {activePopups.map(popup => (
          <div key={popup.id} className="bg-status-critical-bg border border-status-critical-text text-status-critical-text px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-right font-bold text-sm pointer-events-auto">
            {popup.msg}
          </div>
        ))}
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-card border border-border text-foreground hover:bg-accent px-4 py-2 rounded-full shadow-lg text-xs font-bold transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          My Alerts ({alerts.length})
        </button>

        {isOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            
            <div className="flex border-b border-border">
              <button 
                onClick={() => setActiveTab("rules")}
                className={`flex-1 py-2 text-xs font-bold ${activeTab === "rules" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              >
                Rules
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-2 text-xs font-bold ${activeTab === "history" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              >
                Notifications
              </button>
            </div>

            <div className="p-4">
              {activeTab === "rules" ? (
                <>
                  <p className="text-xs text-muted-foreground mb-4">Get notified when traffic hits a specific IP or Domain.</p>
                  <form onSubmit={addAlert} className="flex gap-2 mb-4">
                    <input type="text" value={newAlert} onChange={e => setNewAlert(e.target.value)} placeholder="e.g. netflix.com" className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                    <button type="submit" className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/90 cursor-pointer">Add</button>
                  </form>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2">No active rules</div>}
                    {alerts.map(alert => (
                      <div key={alert} className="flex items-center justify-between bg-background border border-border rounded px-2 py-1.5 text-xs">
                        <span className="text-foreground truncate">{alert}</span>
                        <button onClick={() => removeAlert(alert)} className="text-muted-foreground hover:text-status-critical-text cursor-pointer">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {history.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2">No historical alerts</div>}
                  {history.map(h => (
                    <div key={h.id} className="bg-background border border-border rounded p-2 text-xs flex flex-col gap-1">
                      <div className="font-bold text-status-critical-text">Rule: {h.matched_rule}</div>
                      <div className="text-foreground truncate" title={h.destination_ip}>{h.destination_ip}</div>
                      <div className="text-muted-foreground text-[10px]">{new Date(h.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
