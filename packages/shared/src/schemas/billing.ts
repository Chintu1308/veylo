import { z } from "zod";

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price_monthly_cents: z.number().int().nonnegative(),
  max_users: z.number().int().positive(),
  features: z.array(z.string()),
});

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  plan_id: z.string(),
  status: z.enum(["active", "past_due", "canceled"]),
  current_period_end: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  status: z.enum(["succeeded", "failed", "pending"]),
  transaction_id: z.string(),
  created_at: z.string(),
});

export const CreateSubscriptionSchema = z.object({
  plan_id: z.string(),
});

export const SimulatedPaymentSchema = z.object({
  subscription_id: z.string().uuid(),
  card_token: z.string(), // simulated token e.g. "tok_visa"
});

export type Plan = z.infer<typeof PlanSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionSchema>;
export type SimulatedPaymentRequest = z.infer<typeof SimulatedPaymentSchema>;
