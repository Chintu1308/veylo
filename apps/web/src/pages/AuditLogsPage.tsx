import {
  IconCode,
  IconInfoCircle,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";

interface AuditLog {
  id: string;
  project_id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  ip_address: string | null;
  user_agent: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export default function AuditLogsPage() {
  const { session, selectedProject } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Payload modal state
  const [selectedPayload, setSelectedPayload] = useState<Record<
    string,
    any
  > | null>(null);

  const projectId = selectedProject?.id;
  const token = session?.access_token;

  async function fetchLogs() {
    if (!projectId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AuditLog[]>(
        `/projects/${projectId}/audit-logs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setLogs(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [projectId, token]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actor_email.toLowerCase().includes(q) ||
      log.target_type.toLowerCase().includes(q) ||
      (log.ip_address ?? "").includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Title + Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable forensic record of administrative activity, scoped strictly with RLS.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-4 border border-border hover:bg-muted/10 text-foreground text-xs font-bold rounded-lg cursor-pointer transition-all uppercase tracking-wider self-start sm:self-auto"
        >
          <IconRefresh size={16} />
          Refresh
        </button>
      </div>

      {/* Filter and Search */}
      <div className="relative w-full max-w-sm">
        <IconSearch
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          placeholder="Filter logs by actor, action, type…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-card border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-sans text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      {/* Error/Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="bg-card border border-status-high-text/30 rounded-xl p-12 text-center flex flex-col items-center gap-4">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-status-high-text mb-1">
              Failed to load audit logs: {error}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ensure your user role has administrative permissions to view audit records.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="px-5 py-2 border border-border hover:bg-muted/10 text-foreground font-semibold rounded-lg text-xs cursor-pointer transition-all uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      ) : (
        /* Dense Data Table (uses JetBrains Mono strictly for technical fields) */
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-fira-mono">
              <thead>
                <tr className="bg-background border-b border-border/85 text-muted-foreground font-sans font-bold">
                  <th className="p-3.5 uppercase tracking-wider">Timestamp</th>
                  <th className="p-3.5 uppercase tracking-wider">Actor</th>
                  <th className="p-3.5 uppercase tracking-wider">Action</th>
                  <th className="p-3.5 uppercase tracking-wider">Target</th>
                  <th className="p-3.5 uppercase tracking-wider">IP Address</th>
                  <th className="p-3.5 uppercase tracking-wider w-[80px] text-center">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-sm font-sans text-muted-foreground">
                      No audit records matched your filter criteria
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                      {/* Timestamp */}
                      <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      {/* Actor */}
                      <td className="p-3.5 font-sans font-bold text-foreground">
                        {log.actor_email}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 font-bold text-primary">
                        {log.action}
                      </td>

                      {/* Target */}
                      <td className="p-3.5 text-muted-foreground">
                        <span className="font-sans font-bold text-foreground">{log.target_type}</span>
                        <span
                          className="text-[10px] opacity-75 ml-1.5 inline-block max-w-[120px] truncate align-middle"
                          title={log.target_id}
                        >
                          ({log.target_id})
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="p-3.5 text-muted-foreground">
                        {log.ip_address ?? "internal"}
                      </td>

                      {/* Payload Viewer trigger */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPayload(log.payload)}
                          className="inline-flex items-center gap-1 text-primary hover:text-accent font-bold cursor-pointer transition-colors"
                        >
                          <IconCode size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[500px] bg-card border border-border shadow-2xl rounded-2xl p-6 relative animate-in zoom-in-95 duration-100 text-left">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-primary">
                <IconInfoCircle size={18} stroke={2.5} />
                <h2 className="text-base font-bold tracking-tight text-foreground">Log Entry Payload</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayload(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            <pre className="m-0 p-4 bg-background border border-border rounded-lg font-fira-mono text-[11px] overflow-x-auto text-foreground max-h-72 box-border">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setSelectedPayload(null)}
                className="px-4 py-2 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
