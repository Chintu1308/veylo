import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Delete,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CreateProjectSchema, AddProjectMemberSchema, CreateProjectRequest, AddProjectMemberRequest } from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProjectsService } from './projects.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

// Decorator to extract current user
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);

@Controller('projects')
@UseGuards(AuthGuard('supabase-jwt'))
export class ProjectsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.projectsService.listProjects(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateProjectSchema))
    body: CreateProjectRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const project = await this.projectsService.createProject(
      body.name,
      body.slug,
      body.description,
      user.sub,
    );

    await this.auditLogsService.logAction({
      projectId: project.id,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'project.created',
      targetType: 'project',
      targetId: project.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { name: body.name, slug: body.slug },
    });

    return project;
  }

  @Patch(':projectId/settings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('project_admin')
  async updateSettings(
    @Param('projectId') projectId: string,
    @Body()
    body: { name: string; description?: string },
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const project = await this.projectsService.updateSettings(
      projectId,
      body.name,
      body.description,
    );

    await this.auditLogsService.logAction({
      projectId: project.id,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'project.settings_updated',
      targetType: 'project',
      targetId: project.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return project;
  }

  @Get(':projectId/members')
  @UseGuards(RolesGuard)
  async listMembers(@Param('projectId') projectId: string) {
    return this.projectsService.listMembers(projectId);
  }

  @Post(':projectId/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('project_admin')
  async addMember(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(AddProjectMemberSchema))
    body: AddProjectMemberRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const member = await this.projectsService.addMember(
      projectId,
      body.email,
      body.role,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'project.collaborator_added',
      targetType: 'collaborator',
      targetId: member.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { email: body.email, role: body.role },
    });

    return member;
  }

  @Delete(':projectId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('project_admin')
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    await this.projectsService.removeMember(projectId, userId);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'project.collaborator_removed',
      targetType: 'collaborator',
      targetId: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { success: true };
  }
}
