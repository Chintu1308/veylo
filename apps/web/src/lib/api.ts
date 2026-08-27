/**
 * API client — thin wrapper around fetch for communicating with the NestJS API.
 * Base URL comes from VITE_API_URL env var.
 *
 * Automatically attaches a Supabase Bearer token when available.
 */
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Pull the current session token (real or mock)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Clear Supabase session and force redirect to login
      await supabase.auth.signOut().catch(() => {});
      window.location.href = `${import.meta.env.BASE_URL}login`;
      throw new Error("Session expired. Please log in again.");
    }
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
