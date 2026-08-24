/**
 * Supabase browser client
 *
 * Uses only the ANON key — safe for browser use.
 * NEVER use the service-role key in the frontend.
 * All sensitive operations (login verification, membership checks) go
 * through the NestJS API which uses the service-role key server-side.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnon ||
  supabaseUrl.includes("placeholder") ||
  supabaseAnon.includes("placeholder");

if (isPlaceholder) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Veylo] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.\n" +
        "Mocking Supabase Auth client for local testing.",
    );
  }
}

// Real Supabase client instance (used when keys are set)
const realSupabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnon ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

// ── Mock implementation ──────────────────────────────────────────────────────
// Generates a fake but structurally-valid JWT for sandbox/dev mode.
// The API's JWT strategy detects sandbox mode and bypasses signature
// verification, so the token only needs to be well-formed base64 JSON.
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  // Fake signature — API sandbox mode skips verification
  return `${encode(header)}.${encode(payload)}.sandbox_fake_sig`;
}

// Store session in memory so getSession returns it after signUp/signIn
let mockSession: {
  access_token: string;
  refresh_token: string;
  user: Record<string, unknown>;
} | null = null;

const mockSupabase = {
  auth: {
    signUp: async (credentials: any) => {
      console.log("[Mock Supabase] signUp called with:", credentials);
      const userId = "00000000-0000-0000-0000-000000000003";
      const email = credentials.email;
      const accessToken = makeFakeJwt({
        sub: userId,
        email,
        role: "authenticated",
        aud: "authenticated",
        project_id: null,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      const user = {
        id: userId,
        email,
        user_metadata: credentials.options?.data ?? {},
      };
      mockSession = {
        access_token: accessToken,
        refresh_token: "mock-refresh-token",
        user,
      };
      return {
        data: { user, session: mockSession },
        error: null,
      };
    },
    signInWithPassword: async (credentials: any) => {
      console.log("[Mock Supabase] signInWithPassword called with:", credentials);
      const userId = "00000000-0000-0000-0000-000000000003";
      const email = credentials.email;
      const accessToken = makeFakeJwt({
        sub: userId,
        email,
        role: "authenticated",
        aud: "authenticated",
        project_id: "00000000-0000-0000-0000-000000000001",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      const user = {
        id: userId,
        email,
        user_metadata: {},
      };
      mockSession = {
        access_token: accessToken,
        refresh_token: "mock-refresh-token",
        user,
      };
      return {
        data: { user, session: mockSession },
        error: null,
      };
    },
    resend: async (params: any) => {
      console.log("[Mock Supabase] resend called with:", params);
      return { data: {}, error: null };
    },
    getSession: async () => ({
      data: { session: mockSession },
      error: null,
    }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => {
      mockSession = null;
      return { error: null };
    },
  },
} as any;

export const supabase = isPlaceholder ? mockSupabase : realSupabase;
