import { z } from "zod";

// ── Project search ─────────────────────────────────────────────────────────────
export const ProjectSearchQuerySchema = z.object({
  q: z.string().min(3, "Search term must be at least 3 characters").max(100),
});

export type ProjectSearchQuery = z.infer<typeof ProjectSearchQuerySchema>;

// ── Login request ─────────────────────────────────────────────────────────────
export const LoginRequestSchema = z.object({
  project_id: z.string().uuid("Invalid project ID").optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ── Login response ────────────────────────────────────────────────────────────
export const LoginResponseSchema = z.object({
  access_token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    display_name: z.string().nullable(),
    role: z.string(),
    project_id: z.string().uuid().nullable().optional(),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ── Registration ──────────────────────────────────────────────────────────────
export const RegisterAdminSchema = z.object({
  display_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});

export type RegisterAdmin = z.infer<typeof RegisterAdminSchema>;

// ── Forgot password ───────────────────────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  project_id: z.string().uuid().optional(),
});

export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>;
