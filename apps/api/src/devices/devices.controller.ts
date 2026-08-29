import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  RegisterDeviceSchema,
  UpdatePostureSchema,
  UpdateDeviceStatusSchema,
  UpdateDeviceNameSchema,
  RegisterDeviceRequest,
  UpdatePostureRequest,
  UpdateDeviceStatusRequest,
  UpdateDeviceNameRequest,
} from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DevicesService } from './devices.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../projects/projects.controller';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

@Controller('projects/:projectId/devices')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class DevicesController {
  constructor(
    @Inject(DevicesService)
    private readonly devicesService: DevicesService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  async getDevices(@Param('projectId') projectId: string) {
    return this.devicesService.listDevices(projectId);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(RegisterDeviceSchema))
    body: RegisterDeviceRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const device = await this.devicesService.registerDevice(projectId, user.sub, body);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'device.registered',
      targetType: 'device',
      targetId: device.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { name: body.name, os: body.os },
    });

    return device;
  }

  @Patch(':deviceId/posture')
  @HttpCode(HttpStatus.OK)
  async updatePosture(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(UpdatePostureSchema))
    body: UpdatePostureRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const device = await this.devicesService.updatePostureScore(
      projectId,
      deviceId,
      body.posture_score,
      body.details,
    );

    if (device.status === 'blocked') {
      await this.auditLogsService.logAction({
        projectId: projectId,
        actorId: null,
        actorEmail: 'system@veylo.io',
        action: 'device.quarantined',
        targetType: 'device',
        targetId: device.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payload: { posture_score: body.posture_score },
      });
    }

    return device;
  }

  @Patch(':deviceId/status')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(UpdateDeviceStatusSchema))
    body: UpdateDeviceStatusRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const device = await this.devicesService.updateDeviceStatus(projectId, deviceId, body.status);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: `device.status_${body.status}`,
      targetType: 'device',
      targetId: device.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return device;
  }

  @Patch(':deviceId/name')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin')
  async updateName(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(UpdateDeviceNameSchema))
    body: UpdateDeviceNameRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const device = await this.devicesService.updateDeviceName(projectId, deviceId, body.name);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'device.renamed',
      targetType: 'device',
      targetId: device.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { name: body.name },
    });

    return device;
  }
}
