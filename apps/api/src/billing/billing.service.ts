import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import type { Plan, Subscription, Payment } from '@veylo/shared';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  async listPlans(): Promise<Plan[]> {
    const { data, error } = await this.supabase.admin
      .from('plans')
      .select('*')
      .order('price_monthly_cents');

    if (error) {
      this.logger.error('Error fetching plans', error.message);
      return [];
    }
    return (data ?? []) as Plan[];
  }

  async getSubscription(projectId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase.admin
      .from('subscriptions')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error fetching subscription for project ${projectId}`, error.message);
      return null;
    }
    return data as Subscription | null;
  }

  async createSubscription(projectId: string, planId: string): Promise<Subscription> {
    const { data: plan, error: planErr } = await this.supabase.admin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planErr || !plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    const existing = await this.getSubscription(projectId);
    let result: any;

    if (existing) {
      const { data, error } = await this.supabase.admin
        .from('subscriptions')
        .update({
          plan_id: planId,
          status: planId === 'free' ? 'active' : 'canceled',
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await this.supabase.admin
        .from('subscriptions')
        .insert({
          project_id: projectId,
          plan_id: planId,
          status: planId === 'free' ? 'active' : 'canceled',
          current_period_end: currentPeriodEnd.toISOString(),
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      result = data;
    }

    return result as Subscription;
  }

  async processSimulatedPayment(
    projectId: string,
    subscriptionId: string,
    cardToken: string,
  ): Promise<Payment> {
    const { data: sub, error: subErr } = await this.supabase.admin
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('project_id', projectId)
      .single();

    if (subErr || !sub) {
      throw new Error(`Subscription ${subscriptionId} not found for this project`);
    }

    const { data: plan, error: planErr } = await this.supabase.admin
      .from('plans')
      .select('*')
      .eq('id', sub.plan_id)
      .single();

    if (planErr || !plan) {
      throw new Error(`Plan associated with subscription not found`);
    }

    const isSuccess = cardToken !== 'tok_charge_declined';
    const amount = plan.price_monthly_cents;

    if (!isSuccess) {
      const txId = 'tx_failed_' + Math.random().toString(36).substring(7);
      await this.supabase.admin.from('payments').insert({
        project_id: projectId,
        subscription_id: subscriptionId,
        amount_cents: amount,
        status: 'failed',
        transaction_id: txId,
      });

      await this.supabase.admin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('id', subscriptionId);

      throw new Error('Card declined. Payment failed.');
    }

    const txId = 'tx_succ_' + Math.random().toString(36).substring(7);
    const { data: payment, error: payErr } = await this.supabase.admin
      .from('payments')
      .insert({
        project_id: projectId,
        subscription_id: subscriptionId,
        amount_cents: amount,
        status: 'succeeded',
        transaction_id: txId,
      })
      .select('*')
      .single();

    if (payErr || !payment) {
      throw new Error(`Payment record failed: ${payErr?.message}`);
    }

    const nextPeriodEnd = new Date();
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.supabase.admin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: nextPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    return payment as Payment;
  }
}
