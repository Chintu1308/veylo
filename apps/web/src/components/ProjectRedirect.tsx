import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiRequest } from "../lib/api";

export default function ProjectRedirect() {
  const navigate = useNavigate();
  const { session, setProject } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    async function fetchAndRedirect() {
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const projects = await apiRequest<any[]>("/projects");
        if (projects && projects.length > 0) {
          const first = projects[0];
          setProject(first);
          navigate(`/${first.slug}`, { replace: true });
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch projects for redirect", err);
        setIsLoading(false);
      }
    }
    fetchAndRedirect();
  }, [session, navigate, setProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError("");

    try {
      const project = await apiRequest<any>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName,
          slug: newProjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
          description: "My first Veylo project"
        })
      });
      setProject(project);
      navigate(`/${project.slug}`, { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to create project");
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground font-mono text-sm animate-pulse">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="flex justify-center mb-8">
          <img src="/veylo_text.png" alt="Veylo" className="h-8 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to Veylo</h1>
        <p className="text-sm text-muted-foreground mb-8">
          You don't have any active projects yet. Create your first Zero Trust workspace to get started.
        </p>

        <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Project Name</label>
            <input
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. Acme Corp Production"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {error && <p className="text-xs text-status-critical-text bg-status-critical-bg p-2 rounded">{error}</p>}

          <button
            type="submit"
            disabled={isCreating || !newProjectName.trim()}
            className="mt-4 px-4 py-2.5 bg-primary hover:bg-accent text-primary-foreground hover:text-black font-bold rounded-lg text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
