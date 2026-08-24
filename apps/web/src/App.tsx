import { useEffect } from "react";
import "./index.css";
import Router from "./router";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const { setSession, logout } = useAuthStore();

  useEffect(() => {
    // 1. Initial check of active session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session) {
        setSession({
          access_token: session.access_token,
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
            display_name: session.user.user_metadata?.display_name || null,
            role: session.user.user_metadata?.role || "authenticated",
          },
        });
      } else {
        logout();
      }
    });

    // 2. Listen for subsequent auth changes (sign-in, token refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session) {
        setSession({
          access_token: session.access_token,
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
            display_name: session.user.user_metadata?.display_name || null,
            role: session.user.user_metadata?.role || "authenticated",
          },
        });
      } else {
        logout();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, logout]);

  return <Router />;
}
