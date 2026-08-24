import { z } from "zod";

export const ProtectedResourceSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  type: z.string(), // 'database', 'ssh', 'http'
  endpoint: z.string(),
  sensitivity: z.enum(["low", "medium", "high", "critical"]),
  created_at: z.string(),
});

export const PolicyRuleConditionSchema = z.object({
  field: z.string(), // e.g. "device_status", "risk_score", "location"
  operator: z.enum(["eq", "neq", "gt", "lt", "contains"]),
  value: z.any(),
});

export const PolicyRuleActionSchema = z.object({
  effect: z.enum(["allow", "allow_monitor", "challenge_mfa", "restrict", "deny", "revoke_session"]),
  risk_adjustment: z.number().int().optional(),
  trigger_alert: z.boolean().default(false),
  trigger_incident: z.boolean().default(false),
});

export const PolicyRuleSchema = z.object({
  name: z.string(),
  conditions: z.array(PolicyRuleConditionSchema),
  actions: z.array(PolicyRuleActionSchema),
});

export const SecurityPolicySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  rules: z.array(PolicyRuleSchema),
  is_active: z.boolean().default(true),
  created_at: z.string(),
});

export const CreateProtectedResourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  endpoint: z.string(),
  sensitivity: z.enum(["low", "medium", "high", "critical"]),
});

export const CreateSecurityPolicySchema = z.object({
  name: z.string().min(1, "Name is required"),
  rules: z.array(PolicyRuleSchema),
  is_active: z.boolean().default(true),
});

export const EvaluateAccessRequestSchema = z.object({
  resource_id: z.string().uuid(),
  device_id: z.string().uuid().optional(),
  network_context: z.object({
    source_ip: z.string(),
    destination_port: z.number().int(),
    protocol: z.string(),
  }),
});

export type ProtectedResource = z.infer<typeof ProtectedResourceSchema>;
export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type CreateProtectedResourceRequest = z.infer<typeof CreateProtectedResourceSchema>;
export type CreateSecurityPolicyRequest = z.infer<typeof CreateSecurityPolicySchema>;
export type EvaluateAccessRequest = z.infer<typeof EvaluateAccessRequestSchema>;
