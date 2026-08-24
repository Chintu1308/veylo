import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../auth/supabase-jwt.strategy';
import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Resolve projectId from request params, query, or headers
    const projectId =
      request.params.projectId ||
      request.params.project_id ||
      request.query.project_id ||
      request.headers['x-project-id'] ||
      request.headers['project-id'];

    if (projectId) {
      // Map role requirements (e.g. 'org_admin' -> 'project_admin')
      const mappedRoles = requiredRoles?.map((r) => {
        if (r === 'org_admin') return 'project_admin';
        return r;
      });

      const isCollaborator = await this.projectsService.verifyProjectCollaborator(
        projectId,
        user.sub,
        mappedRoles,
      );

      if (!isCollaborator) {
        throw new ForbiddenException(
          'Access denied: you do not have permissions for this project',
        );
      }
    }

    return true;
  }
}
