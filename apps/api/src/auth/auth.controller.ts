import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Inject,
} from '@nestjs/common';
import {
  LoginRequestSchema,
  ProjectSearchQuerySchema,
  ForgotPasswordSchema,
  RegisterAdminSchema,
  LoginRequest,
  ForgotPassword,
  RegisterAdmin,
} from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * GET /auth/projects?q=<term>
   * Project search.
   */
  @Get('projects')
  async searchProjects(
    @Query(new ZodValidationPipe(ProjectSearchQuerySchema)) query: { q: string },
  ) {
    // Standard project search is resolved via ProjectsService (e.g. search globally if public, or list)
    // For sandbox, we just return matching projects
    const all = await this.projectsService.listProjects('00000000-0000-0000-0000-000000000003');
    return all.filter((p) => p.name.toLowerCase().includes(query.q.toLowerCase()));
  }

  /**
   * POST /auth/login
   * Body: { email, password, project_id? }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema))
    body: LoginRequest,
  ) {
    return this.authService.login(body);
  }

  /**
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout() {
    return;
  }

  /**
   * POST /auth/forgot-password
   * Body: { email, project_id? }
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema))
    body: ForgotPassword,
  ) {
    await this.authService.forgotPassword(body.email, body.project_id);
    return { success: true };
  }

  /**
   * POST /auth/register
   * Body: { display_name, email, password }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(RegisterAdminSchema))
    body: RegisterAdmin,
  ) {
    return this.authService.register(body);
  }
}
