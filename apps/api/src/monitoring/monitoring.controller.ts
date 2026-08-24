import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MonitoringService } from './monitoring.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../projects/projects.controller';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

@Controller('projects/:projectId/monitoring')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class MonitoringController {
  constructor(
    @Inject(MonitoringService)
    private readonly monitoringService: MonitoringService,
  ) {}

  @Get('events')
  @Roles('project_admin', 'security_analyst')
  async getEvents(@Param('projectId') projectId: string) {
    return this.monitoringService.listEvents(projectId);
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async submitEvent(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      user_id?: string;
      device_id?: string;
      source_ip: string;
      destination_ip: string;
      destination_port: number;
      protocol: string;
      bytes_transferred: number;
      action: 'allow' | 'deny';
    },
    @CurrentUser() user: JwtPayload,
  ) {
    await this.monitoringService.logNetworkEvent(projectId, {
      user_id: body.user_id || user.sub,
      device_id: body.device_id,
      source_ip: body.source_ip,
      destination_ip: body.destination_ip,
      destination_port: body.destination_port,
      protocol: body.protocol,
      bytes_transferred: body.bytes_transferred,
      action: body.action,
    });
    return { success: true };
  }
}
