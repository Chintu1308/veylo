import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiRequest } from "../lib/api";

export default function ProjectRedirect() {
  const navigate = useNavigate();
  const { session, setProject } = useAuthStore();

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
          // If no projects, maybe stay on landing or go to a create page
          navigate("/", { replace: true });
        }
      } catch (err) {
        console.error("Failed to fetch projects for redirect", err);
        navigate("/", { replace: true });
      }
    }
    fetchAndRedirect();
  }, [session, navigate, setProject]);

  return <div className="p-8 text-center text-muted-foreground font-mono text-sm animate-pulse">Loading workspace...</div>;
}
