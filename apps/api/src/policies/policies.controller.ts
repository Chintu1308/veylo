import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  CreateProtectedResourceSchema,
  CreateSecurityPolicySchema,
  EvaluateAccessRequestSchema,
  CreateProtectedResourceRequest,
  CreateSecurityPolicyRequest,
  EvaluateAccessRequest,
} from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PoliciesService } from './policies.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../projects/projects.controller';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

@Controller('projects/:projectId/policies')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class PoliciesController {
  constructor(
    @Inject(PoliciesService)
    private readonly policiesService: PoliciesService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ── Protected Resources ────────────────────────────────────────────────────
  @Get('resources')
  async getResources(@Param('projectId') projectId: string) {
    return this.policiesService.listResources(projectId);
  }

  @Post('resources')
  @HttpCode(HttpStatus.CREATED)
  @Roles('project_admin')
  async createResource(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateProtectedResourceSchema))
    body: CreateProtectedResourceRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const resource = await this.policiesService.createResource(projectId, body);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'policy.resource_created',
      targetType: 'protected_resource',
      targetId: resource.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { name: body.name, type: body.type },
    });

    return resource;
  }

  // ── Security Policies ──────────────────────────────────────────────────────
  @Get()
  async getPolicies(@Param('projectId') projectId: string) {
    return this.policiesService.listPolicies(projectId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('project_admin')
  async createPolicy(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateSecurityPolicySchema))
    body: CreateSecurityPolicyRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const policy = await this.policiesService.createPolicy(projectId, body);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'policy.rule_created',
      targetType: 'security_policy',
      targetId: policy.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { name: body.name, rules_count: body.rules.length },
    });

    return policy;
  }

  // ── Evaluate Access Request ────────────────────────────────────────────────
  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluate(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(EvaluateAccessRequestSchema))
    body: EvaluateAccessRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const result = await this.policiesService.evaluateAccessRequest(
      projectId,
      user.sub,
      body,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: `policy.evaluation_${result.decision}`,
      targetType: 'protected_resource',
      targetId: body.resource_id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: {
        device_id: body.device_id,
        risk_score: result.riskScore,
        decision: result.decision,
      },
    });

    return result;
  }
}
