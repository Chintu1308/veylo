import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  CreateIncidentSchema,
  UpdateIncidentSchema,
  CreateAlertSchema,
  UpdateAlertSchema,
  CreateForensicEventSchema,
  CreateIncidentRequest,
  UpdateIncidentRequest,
  CreateAlertRequest,
  UpdateAlertRequest,
  CreateForensicEventRequest,
} from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IncidentsService } from './incidents.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../projects/projects.controller';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

@Controller('projects/:projectId')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class IncidentsController {
  constructor(
    @Inject(IncidentsService)
    private readonly incidentsService: IncidentsService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ── Incidents ──────────────────────────────────────────────────────────────
  @Get('incidents')
  @Roles('project_admin', 'security_analyst')
  async getIncidents(@Param('projectId') projectId: string) {
    return this.incidentsService.listIncidents(projectId);
  }

  @Post('incidents')
  @HttpCode(HttpStatus.CREATED)
  @Roles('project_admin', 'security_analyst')
  async createIncident(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateIncidentSchema))
    body: CreateIncidentRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const incident = await this.incidentsService.createIncident(
      projectId,
      body.title,
      body.severity,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'incident.created',
      targetType: 'incident',
      targetId: incident.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { code: incident.incident_code, title: body.title },
    });

    return incident;
  }

  @Patch('incidents/:incidentId')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin', 'security_analyst')
  async updateIncident(
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Body(new ZodValidationPipe(UpdateIncidentSchema))
    body: UpdateIncidentRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const incident = await this.incidentsService.updateIncident(
      projectId,
      incidentId,
      body.status,
      body.assignee_id,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'incident.updated',
      targetType: 'incident',
      targetId: incidentId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: body,
    });

    return incident;
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  @Get('alerts')
  @Roles('project_admin', 'security_analyst')
  async getAlerts(@Param('projectId') projectId: string) {
    return this.incidentsService.listAlerts(projectId);
  }

  @Post('alerts')
  @HttpCode(HttpStatus.CREATED)
  @Roles('project_admin', 'security_analyst')
  async createAlert(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateAlertSchema))
    body: CreateAlertRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const alert = await this.incidentsService.createAlert(
      projectId,
      body.title,
      body.description,
      body.severity,
      body.incident_id,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'alert.triggered',
      targetType: 'alert',
      targetId: alert.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return alert;
  }

  @Patch('alerts/:alertId')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin', 'security_analyst')
  async updateAlert(
    @Param('projectId') projectId: string,
    @Param('alertId') alertId: string,
    @Body(new ZodValidationPipe(UpdateAlertSchema))
    body: UpdateAlertRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const alert = await this.incidentsService.updateAlertStatus(
      projectId,
      alertId,
      body.status,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: `alert.status_${body.status}`,
      targetType: 'alert',
      targetId: alertId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return alert;
  }

  // ── Forensics Ledger ───────────────────────────────────────────────────────
  @Get('forensics')
  @Roles('project_admin', 'security_analyst')
  async getForensicEvents(
    @Param('projectId') projectId: string,
    @Query('incident_id') incidentId?: string,
  ) {
    return this.incidentsService.listForensicEvents(projectId, incidentId);
  }

  @Post('forensics/events')
  @Roles('project_admin', 'security_analyst')
  async createForensicEvent(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateForensicEventSchema))
    body: CreateForensicEventRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const event = await this.incidentsService.createForensicEvent(
      projectId,
      body.incident_id,
      body.event_data,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'forensics.event_logged',
      targetType: 'forensic_event',
      targetId: event.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return event;
  }
}
