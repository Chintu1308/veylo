import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string().min(2, "Project name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug may only contain lowercase letters, numbers, and hyphens",
    ),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProjectMemberSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["project_admin", "security_analyst", "protected_user"]),
  status: z.enum(["active", "pending"]),
  created_at: z.string(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug may only contain lowercase letters, numbers, and hyphens",
    ),
  description: z.string().max(500).optional(),
});

export const AddProjectMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["project_admin", "security_analyst", "protected_user"]),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type AddProjectMemberRequest = z.infer<typeof AddProjectMemberSchema>;
