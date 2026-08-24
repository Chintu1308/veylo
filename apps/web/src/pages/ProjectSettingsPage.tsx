import {
  IconCheck,
  IconCode,
} from "@tabler/icons-react";
import React, { useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function ProjectSettingsPage() {
  const { session, selectedProject, setProject } = useAuthStore();
  const [name, setName] = useState(
    selectedProject?.name ?? ""
  );
  const [description, setDescription] = useState(selectedProject?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = selectedProject?.id;
  const token = session?.access_token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !token) return;
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const updatedProject = await apiRequest<any>(
        `/projects/${projectId}/settings`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
          }),
        },
      );

      // Update local Zustand store
      setProject(updatedProject);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Project Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Veylo telemetry project details, slug, and descriptions.
        </p>
      </div>

      {/* Main Settings Form */}
      <div className="bg-card border border-border rounded-2xl p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Project Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              Project Name
            </label>
            <div className="relative">
              <IconCode
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                required
                className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 pl-10 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Project URL Slug (ReadOnly) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              URL Slug
            </label>
            <input
              type="text"
              value={selectedProject?.slug ?? ""}
              disabled
              className="w-full bg-muted border border-border text-muted-foreground rounded-lg py-2.5 px-4 font-mono text-sm cursor-not-allowed opacity-70"
            />
            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
              URL slugs are permanently assigned for routing security. Contact support to change slugs.
            </p>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this project's security boundaries..."
              className="w-full bg-background border border-border text-foreground rounded-lg py-2.5 px-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all h-24 resize-none"
            />
          </div>

          {/* Error / Success messages */}
          {error && (
            <p className="text-xs text-status-critical-text font-medium leading-relaxed">
              {error}
            </p>
          )}
          {success && (
            <div className="inline-flex items-center gap-1.5 text-status-low-text bg-status-low-bg border border-status-low-text/30 px-3.5 py-2 rounded-lg text-xs font-semibold self-start">
              <IconCheck size={14} stroke={3} /> Settings updated successfully
            </div>
          )}

          {/* Form Actions */}
          <div className="border-t border-border/80 pt-5 flex justify-end mt-2">
            <button
              type="submit"
              disabled={saving || !name}
              className="px-5 py-2.5 bg-primary hover:bg-accent hover:text-black text-primary-foreground font-bold rounded-lg text-xs cursor-pointer transition-all shadow-md disabled:opacity-50 uppercase tracking-wider"
            >
              {saving ? "Saving changes…" : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
