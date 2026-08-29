import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { Project } from "@veylo/shared";

export default function ProjectGuard({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { setProject, selectedProject } = useAuthStore();

  useEffect(() => {
    if (!slug) return;
    
    // Quick cache hit to avoid flickering if already set
    if (selectedProject?.slug === slug) {
      setLoading(false);
      return;
    }

    setLoading(true);
    apiRequest<Project>(`/projects/by-slug/${slug}`)
      .then((project) => {
        setProject(project);
        setError(null);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load project");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground">
        <div className="spinner mb-4" />
        <p className="text-sm font-semibold tracking-wide">Loading workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-status-critical-bg text-status-critical-text rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4v.01M5.07 19H19a2 2 0 0 0 1.75-2.75L13.75 4a2 2 0 0 0-3.5 0L3.25 16.25a2 2 0 0 0 1.75 2.75"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm mx-auto mb-8 leading-relaxed">
          {error.includes("Not an active collaborator") || error.includes("Not found")
            ? "You don't have permission to access this project, or it doesn't exist."
            : error}
        </p>
        <button
          onClick={() => window.location.href = import.meta.env.BASE_URL}
          className="px-6 py-3 bg-primary hover:bg-accent text-primary-foreground font-bold rounded-lg transition-all"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
