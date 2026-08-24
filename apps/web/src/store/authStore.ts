import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LoginResponse, Project } from "@veylo/shared";

interface AuthState {
  // Selected project (cleared on project switch or logout)
  selectedProject: Project | null;
  // Authenticated session from the API
  session: LoginResponse | null;

  // Actions
  setProject: (project: Project) => void;
  clearProject: () => void;
  setSession: (session: LoginResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      selectedProject: null,
      session: null,

      setProject: (project) => set({ selectedProject: project }),

      clearProject: () => set({ selectedProject: null }),

      setSession: (session) => set({ session }),

      logout: () => set({ selectedProject: null, session: null }),
    }),
    {
      name: "veylo-auth",
      partialize: (state) => ({
        selectedProject: state.selectedProject,
        session: state.session,
      }),
    },
  ),
);
