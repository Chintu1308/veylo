import { z } from "zod";

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  os: z.string(),
  status: z.enum(["approved", "pending", "blocked"]),
  posture_score: z.number().int().min(0).max(100),
  last_seen_at: z.string(),
  created_at: z.string(),
});

export const DeviceHistorySchema = z.object({
  id: z.string().uuid(),
  device_id: z.string().uuid(),
  posture_score: z.number().int().min(0).max(100),
  details: z.record(z.any()),
  created_at: z.string(),
});

export const RegisterDeviceSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  os: z.string().min(1, "Operating System is required"),
});

export const UpdatePostureSchema = z.object({
  posture_score: z.number().int().min(0).max(100),
  details: z.record(z.any()).default({}),
});

export const UpdateDeviceStatusSchema = z.object({
  status: z.enum(["approved", "pending", "blocked"]),
});

export type Device = z.infer<typeof DeviceSchema>;
export type DeviceHistory = z.infer<typeof DeviceHistorySchema>;
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceSchema>;
export type UpdatePostureRequest = z.infer<typeof UpdatePostureSchema>;
export type UpdateDeviceStatusRequest = z.infer<typeof UpdateDeviceStatusSchema>;
