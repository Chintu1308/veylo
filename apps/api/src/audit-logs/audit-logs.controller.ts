import { Controller, Get, Param, Req, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('projects/:projectId/audit-logs')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class AuditLogsController {
  constructor(
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  @Roles('project_admin', 'security_analyst')
  async getLogs(@Param('projectId') projectId: string, @Req() req: Request) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.replace('Bearer ', '');
    return this.auditLogsService.getLogs(projectId, token);
  }
}
