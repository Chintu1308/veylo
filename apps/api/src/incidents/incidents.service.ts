import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import type { Incident, Alert, ForensicEvent } from '@veylo/shared';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  // ── Incidents ──────────────────────────────────────────────────────────────
  async listIncidents(projectId: string): Promise<Incident[]> {
    const { data, error } = await this.supabase.admin
      .from('incidents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error listing incidents: ${error.message}`);
      return [];
    }
    return (data ?? []) as Incident[];
  }

  async createIncident(
    projectId: string,
    title: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ): Promise<Incident> {
    const year = new Date().getFullYear();
    const countRes = await this.supabase.admin
      .from('incidents')
      .select('id')
      .eq('project_id', projectId);

    const count = (countRes.data?.length ?? 0) + 1;
    const padCount = String(count).padStart(4, '0');
    const incidentCode = `VEY-${year}-${padCount}`;

    const { data: incident, error } = await this.supabase.admin
      .from('incidents')
      .insert({
        project_id: projectId,
        incident_code: incidentCode,
        title,
        severity,
        status: 'open',
      })
      .select('*')
      .single();

    if (error || !incident) {
      throw new Error(`Failed to create incident: ${error?.message}`);
    }

    await this.createForensicEvent(
      projectId,
      incident.id,
      `Incident [${incidentCode}] created: "${title}" with severity [${severity}].`,
    );

    return incident as Incident;
  }

  async updateIncident(
    projectId: string,
    incidentId: string,
    status?: 'open' | 'investigating' | 'resolved',
    assigneeId?: string | null,
  ): Promise<Incident> {
    const existing = await this.supabase.admin
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .eq('project_id', projectId)
      .single();

    if (existing.error || !existing.data) {
      throw new Error('Incident not found');
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (assigneeId !== undefined) updates.assignee_id = assigneeId;

    const { data: incident, error } = await this.supabase.admin
      .from('incidents')
      .update(updates)
      .eq('id', incidentId)
      .select('*')
      .single();

    if (error || !incident) {
      throw new Error(`Failed to update incident: ${error?.message}`);
    }

    let changeDesc = `Incident [${incident.incident_code}] updated: `;
    if (status) changeDesc += `status set to [${status}]. `;
    if (assigneeId) changeDesc += `assigned to analyst [${assigneeId}]. `;
    if (assigneeId === null) changeDesc += `unassigned. `;

    await this.createForensicEvent(projectId, incidentId, changeDesc.trim());

    return incident as Incident;
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  async listAlerts(projectId: string): Promise<Alert[]> {
    const { data, error } = await this.supabase.admin
      .from('alerts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error listing alerts: ${error.message}`);
      return [];
    }
    return (data ?? []) as Alert[];
  }

  async createAlert(
    projectId: string,
    title: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    incidentId?: string,
  ): Promise<Alert> {
    const { data: alert, error } = await this.supabase.admin
      .from('alerts')
      .insert({
        project_id: projectId,
        incident_id: incidentId ?? null,
        title,
        description,
        severity,
        status: 'open',
      })
      .select('*')
      .single();

    if (error || !alert) {
      throw new Error(`Failed to create alert: ${error?.message}`);
    }

    await this.createForensicEvent(
      projectId,
      incidentId,
      `Security Alert Triggered: "${title}" - "${description}" (Severity: ${severity}).`,
    );

    return alert as Alert;
  }

  async updateAlertStatus(
    projectId: string,
    alertId: string,
    status: 'open' | 'acknowledged' | 'resolved',
  ): Promise<Alert> {
    const { data: alert, error } = await this.supabase.admin
      .from('alerts')
      .update({ status })
      .eq('id', alertId)
      .eq('project_id', projectId)
      .select('*')
      .single();

    if (error || !alert) {
      throw new Error(`Failed to update alert: ${error?.message}`);
    }

    if (alert.incident_id) {
      await this.createForensicEvent(
        projectId,
        alert.incident_id,
        `Security Alert [${alert.id}] status changed to [${status}].`,
      );
    }

    return alert as Alert;
  }

  // ── Cryptographic Forensics ────────────────────────────────────────────────
  async listForensicEvents(projectId: string, incidentId?: string): Promise<ForensicEvent[]> {
    let query = this.supabase.admin
      .from('forensic_events')
      .select('*')
      .eq('project_id', projectId);

    if (incidentId) {
      query = query.eq('incident_id', incidentId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Error listing forensic events: ${error.message}`);
      return [];
    }
    return (data ?? []) as ForensicEvent[];
  }

  async createForensicEvent(
    projectId: string,
    incidentId: string | undefined,
    eventData: string,
  ): Promise<ForensicEvent> {
    const { data, error } = await this.supabase.admin
      .from('forensic_events')
      .insert({
        project_id: projectId,
        incident_id: incidentId ?? null,
        event_data: eventData,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to write forensic event: ${error?.message}`);
    }
    return data as ForensicEvent;
  }
}
