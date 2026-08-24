import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import type {
  ProtectedResource,
  SecurityPolicy,
  CreateProtectedResourceRequest,
  CreateSecurityPolicyRequest,
  EvaluateAccessRequest,
} from '@veylo/shared';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  // ── Protected Resources ────────────────────────────────────────────────────
  async listResources(projectId: string): Promise<ProtectedResource[]> {
    const { data, error } = await this.supabase.admin
      .from('protected_resources')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      this.logger.error(`Error listing resources for project ${projectId}`, error.message);
      return [];
    }
    return (data ?? []) as ProtectedResource[];
  }

  async createResource(
    projectId: string,
    req: CreateProtectedResourceRequest,
  ): Promise<ProtectedResource> {
    const { data, error } = await this.supabase.admin
      .from('protected_resources')
      .insert({
        project_id: projectId,
        name: req.name,
        type: req.type,
        endpoint: req.endpoint,
        sensitivity: req.sensitivity,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create resource: ${error?.message}`);
    }
    return data as ProtectedResource;
  }

  // ── Security Policies ──────────────────────────────────────────────────────
  async listPolicies(projectId: string): Promise<SecurityPolicy[]> {
    const { data, error } = await this.supabase.admin
      .from('security_policies')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      this.logger.error(`Error listing policies for project ${projectId}`, error.message);
      return [];
    }
    return (data ?? []) as SecurityPolicy[];
  }

  async createPolicy(
    projectId: string,
    req: CreateSecurityPolicyRequest,
  ): Promise<SecurityPolicy> {
    const { data, error } = await this.supabase.admin
      .from('security_policies')
      .insert({
        project_id: projectId,
        name: req.name,
        rules: req.rules,
        is_active: req.is_active,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create policy: ${error?.message}`);
    }
    return data as SecurityPolicy;
  }

  // ── Zero Trust Risk & Policy Evaluation Engine ─────────────────────────────
  async evaluateAccessRequest(
    projectId: string,
    userId: string,
    req: EvaluateAccessRequest,
  ): Promise<{
    decision: 'allow' | 'allow_monitor' | 'challenge_mfa' | 'restrict' | 'deny' | 'revoke_session';
    riskScore: number;
    explanation: string[];
    triggeredAlert: boolean;
    triggeredIncident: boolean;
  }> {
    const explanation: string[] = [];

    const { data: resource, error: resErr } = await this.supabase.admin
      .from('protected_resources')
      .select('*')
      .eq('id', req.resource_id)
      .eq('project_id', projectId)
      .single();

    if (resErr || !resource) {
      throw new Error(`Protected resource ${req.resource_id} not found`);
    }

    let deviceStatus = 'unknown';
    let devicePosture = 50;
    if (req.device_id) {
      const { data: device } = await this.supabase.admin
        .from('devices')
        .select('*')
        .eq('id', req.device_id)
        .eq('project_id', projectId)
        .maybeSingle();

      if (device) {
        deviceStatus = device.status;
        devicePosture = device.posture_score;
      }
    }

    let identityRisk = 0;
    let deviceRisk = 50;
    let networkRisk = 10;
    let behaviourRisk = 15;
    let resourceRisk = 30;

    explanation.push('Baseline authentication verified (+0 Identity Risk)');

    if (deviceStatus === 'approved') {
      deviceRisk = Math.max(0, 100 - devicePosture);
      explanation.push(`Approved device posture score: ${devicePosture} (+${deviceRisk} Device Risk)`);
    } else if (deviceStatus === 'blocked') {
      deviceRisk = 100;
      explanation.push('Quarantined/Blocked device access attempt (+100 Device Risk)');
    } else {
      deviceRisk = 80;
      explanation.push('Unregistered/Unknown device accessing critical boundaries (+80 Device Risk)');
    }

    const isIpSpike = req.network_context.source_ip.startsWith('10.99.');
    if (isIpSpike) {
      networkRisk = 90;
      explanation.push(`Restricted IP block destination detected: ${req.network_context.source_ip} (+90 Network Risk)`);
    } else {
      explanation.push(`Standard source IP context verified: ${req.network_context.source_ip} (+10 Network Risk)`);
    }

    if (resource.sensitivity === 'low') {
      resourceRisk = 10;
    } else if (resource.sensitivity === 'medium') {
      resourceRisk = 35;
    } else if (resource.sensitivity === 'high') {
      resourceRisk = 70;
    } else if (resource.sensitivity === 'critical') {
      resourceRisk = 95;
    }
    explanation.push(`Resource sensitivity level (${resource.sensitivity}) rating (+${resourceRisk} Resource Risk)`);

    const finalRiskScore = Math.round(
      identityRisk * 0.2 +
      deviceRisk * 0.2 +
      networkRisk * 0.25 +
      behaviourRisk * 0.2 +
      resourceRisk * 0.15
    );

    explanation.push(`Composite continuous risk index computed: ${finalRiskScore}`);

    let finalDecision: 'allow' | 'allow_monitor' | 'challenge_mfa' | 'restrict' | 'deny' | 'revoke_session' = 'allow';
    if (finalRiskScore > 30) finalDecision = 'challenge_mfa';
    if (finalRiskScore > 60) finalDecision = 'restrict';
    if (finalRiskScore > 80) finalDecision = 'deny';

    let triggeredAlert = false;
    let triggeredIncident = false;

    const policies = await this.listPolicies(projectId);
    const activePolicies = policies.filter((p) => p.is_active);

    for (const policy of activePolicies) {
      for (const rule of policy.rules) {
        let conditionsMatch = true;

        for (const condition of rule.conditions) {
          let fieldVal: any;
          if (condition.field === 'device_status') fieldVal = deviceStatus;
          else if (condition.field === 'risk_score') fieldVal = finalRiskScore;
          else if (condition.field === 'sensitivity') fieldVal = resource.sensitivity;

          if (condition.operator === 'eq' && fieldVal !== condition.value) conditionsMatch = false;
          if (condition.operator === 'neq' && fieldVal === condition.value) conditionsMatch = false;
          if (condition.operator === 'gt' && fieldVal <= condition.value) conditionsMatch = false;
          if (condition.operator === 'lt' && fieldVal >= condition.value) conditionsMatch = false;
        }

        if (conditionsMatch && rule.actions.length > 0) {
          explanation.push(`Triggered Security Policy Rule: [${policy.name}] -> ${rule.name}`);
          const action = rule.actions[0];
          finalDecision = action.effect;
          if (action.trigger_alert) triggeredAlert = true;
          if (action.trigger_incident) triggeredIncident = true;
        }
      }
    }

    return {
      decision: finalDecision,
      riskScore: finalRiskScore,
      explanation,
      triggeredAlert,
      triggeredIncident,
    };
  }
}
