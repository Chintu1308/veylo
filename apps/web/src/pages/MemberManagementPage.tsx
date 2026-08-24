import {
  IconDotsVertical,
  IconMail,
  IconPlus,
  IconShield,
  IconUserMinus,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";

interface Member {
  id: string;
  membership_id: string;
  email: string;
  display_name: string | null;
  role: "project_admin" | "security_analyst" | "protected_user";
  status: "active" | "pending";
  created_at: string;
}

export default function MemberManagementPage() {
  const { session, selectedProject } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "project_admin" | "security_analyst" | "protected_user"
  >("protected_user");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Active Dropdown Action State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const projectId = selectedProject?.id;
  const token = session?.access_token;

  async function fetchMembers() {
    if (!projectId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Member[]>(
        `/projects/${projectId}/members`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setMembers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, [projectId, token]);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !token || !inviteEmail) return;
    setInviteError(null);
    setInviting(true);

    try {
      await apiRequest(`/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("protected_user");
      fetchMembers();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveCollaborator(userId: string) {
    if (!projectId || !token) return;
    const confirm = window.confirm("Are you sure you want to remove this collaborator from the project?");
    if (!confirm) return;

    try {
      await apiRequest(`/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMembers();
      setActiveMenuId(null);
    } catch (err: any) {
      alert(`Failed to remove collaborator: ${err.message}`);
    }
  }

  return (
    <div className="flex flex-col gap-8 text-left">
      {/* Title + Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Collaborators</h1>
          <p className="text-sm text-muted-foreground">
            Manage project access, invite developers, and configure telemetry roles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md uppercase tracking-wider self-start sm:self-auto"
        >
          <IconPlus size={16} />
          Add Collaborator
        </button>
      </div>

      {/* Error/Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-foreground">
            Failed to load collaborators: {error}
          </p>
          <button
            type="button"
            onClick={fetchMembers}
            className="px-5 py-2 border border-border hover:bg-muted/10 text-foreground font-semibold rounded-lg text-xs cursor-pointer transition-all uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      ) : members.length === 0 ? (
        /* Empty State */
        <div className="bg-card border border-border rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
            <IconShield size={24} />
          </div>
          <div className="max-w-sm">
            <h3 className="font-bold text-foreground text-base mb-1.5">No Collaborators Registered</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add members to your team to grant access to telemetry streams, security rules, and incident forensic audits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-2.5 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm uppercase tracking-wider mt-2"
          >
            Add Your First Collaborator
          </button>
        </div>
      ) : (
        /* Members Table */
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-background border-b border-border/80">
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Collaborator
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-[60px] text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/5 transition-colors">
                    {/* User Profile name/email */}
                    <td className="p-4 flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-sm">
                        {(member.display_name ?? member.email).slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground leading-snug">
                          {member.display_name ?? member.email.split("@")[0]}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5 leading-none">
                          {member.email}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 border border-border bg-background rounded uppercase">
                        {member.role.replace("_", " ")}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 border rounded uppercase ${
                        member.status === "active"
                          ? "bg-status-low-bg text-status-low-text border-status-low-text/20"
                          : "bg-status-medium-bg text-status-medium-text border-status-medium-text/20"
                      }`}>
                        {member.status}
                      </span>
                    </td>

                    {/* Action dropdown menu */}
                    <td className="p-4 text-center relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(
                            activeMenuId === member.id ? null : member.id
                          )
                        }
                        className="text-muted-foreground hover:text-foreground cursor-pointer p-1 inline-flex rounded-lg hover:bg-muted/10 transition-colors"
                      >
                        <IconDotsVertical size={16} />
                      </button>

                      {activeMenuId === member.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-4 top-10 w-44 bg-card border border-border shadow-xl rounded-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => handleRemoveCollaborator(member.id)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-semibold text-status-critical-text hover:bg-status-critical-bg/10 cursor-pointer transition-colors"
                            >
                              <IconUserMinus size={14} />
                              Remove Access
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[460px] bg-card border border-border shadow-2xl rounded-2xl p-6 relative animate-in zoom-in-95 duration-100 text-left">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Add Collaborator</h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
              
              {/* Work Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Work Email
                </label>
                <div className="relative">
                  <IconMail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@domain.com"
                    required
                    className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Assigned Role */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-3 font-mono text-sm focus:outline-none focus:border-primary cursor-pointer transition-all mb-2"
                >
                  <option value="protected_user">Protected User</option>
                  <option value="security_analyst">Security Analyst</option>
                  <option value="project_admin">Project Admin</option>
                </select>

                {/* Role Description Context Box */}
                <div className="bg-background border border-border rounded-lg p-3.5 text-xs text-muted-foreground leading-relaxed">
                  {inviteRole === "project_admin" && (
                    <span className="block text-[11px]">
                      <strong className="text-foreground">Project Admin</strong>: Full administrative control. Can configure security policies, manage collaborator access levels, register protected resources, and review billing.
                    </span>
                  )}
                  {inviteRole === "security_analyst" && (
                    <span className="block text-[11px]">
                      <strong className="text-foreground">Security Analyst</strong>: Monitoring privileges. Can view network event alerts, inspect threat detections, review incident forensic chains, and append investigation logs. Cannot update project settings or billing.
                    </span>
                  )}
                  {inviteRole === "protected_user" && (
                    <span className="block text-[11px]">
                      <strong className="text-foreground">Protected User</strong>: Subject to telemetry policies. Can register personal endpoints (devices), complete MFA policy challenges, and access protected resources. Cannot view dashboard stats or logs.
                    </span>
                  )}
                </div>
              </div>

              {inviteError && (
                <p className="text-xs text-status-critical-text font-medium leading-relaxed">
                  {inviteError}
                </p>
              )}

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-border hover:bg-muted/10 text-foreground font-semibold rounded-lg text-xs cursor-pointer transition-all uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="px-4 py-2 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider"
                >
                  {inviting ? "Inviting…" : "Add Collaborator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
