import { z } from "zod";

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  incident_code: z.string(),
  title: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "investigating", "resolved"]),
  assignee_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});

export const AlertSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  incident_id: z.string().uuid().nullable().optional(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "acknowledged", "resolved"]),
  created_at: z.string(),
});

export const ForensicEventSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  incident_id: z.string().uuid().nullable().optional(),
  event_data: z.string(),
  previous_hash: z.string().nullable().optional(),
  current_hash: z.string().nullable().optional(),
  created_at: z.string(),
});

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export const UpdateIncidentSchema = z.object({
  status: z.enum(["open", "investigating", "resolved"]).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
});

export const CreateAlertSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  incident_id: z.string().uuid().optional(),
});

export const UpdateAlertSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved"]),
});

export const CreateForensicEventSchema = z.object({
  incident_id: z.string().uuid().optional(),
  event_data: z.string().min(1, "Event data cannot be empty"),
});

export type Incident = z.infer<typeof IncidentSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type ForensicEvent = z.infer<typeof ForensicEventSchema>;
export type CreateIncidentRequest = z.infer<typeof CreateIncidentSchema>;
export type UpdateIncidentRequest = z.infer<typeof UpdateIncidentSchema>;
export type CreateAlertRequest = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertRequest = z.infer<typeof UpdateAlertSchema>;
export type CreateForensicEventRequest = z.infer<typeof CreateForensicEventSchema>;
