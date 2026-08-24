import {
  Injectable,
  Logger,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import type { LoginRequest, LoginResponse, RegisterAdmin } from '@veylo/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Authenticate email/password.
   * Scopes the session to a target project.
   */
  async login(dto: LoginRequest): Promise<LoginResponse> {
    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await this.supabase.admin.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (authError || !authData.user || !authData.session) {
      this.logger.warn('Login failed: invalid credentials');
      throw new UnauthorizedException(
        'Invalid credentials or you are not a member of this project.',
      );
    }

    // Step 2: Verify project collaborator access or auto-resolve if not specified
    let targetProjectId: string | null = dto.project_id ?? null;

    if (!targetProjectId) {
      // Find any project this user owns or is a collaborator on
      const { data: owned } = await this.supabase.admin
        .from('projects')
        .select('id')
        .eq('owner_id', authData.user.id)
        .limit(1);

      if (owned && owned.length > 0) {
        targetProjectId = owned[0].id;
      } else {
        const { data: memberships } = await this.supabase.admin
          .from('project_members')
          .select('project_id')
          .eq('user_id', authData.user.id)
          .eq('status', 'active')
          .limit(1);

        if (memberships && memberships.length > 0) {
          targetProjectId = memberships[0].project_id;
        }
      }

      if (!targetProjectId) {
        this.logger.warn('No projects found for logging in user');
      }
    } else {
      // Verify collaborator access on specified project
      const { data: isMember, error: memberErr } = await this.supabase.admin.rpc(
        'verify_project_membership',
        {
          p_user_id: authData.user.id,
          p_project_id: targetProjectId,
        },
      );

      // Check ownership too
      const { data: project } = await this.supabase.admin
        .from('projects')
        .select('owner_id')
        .eq('id', targetProjectId)
        .maybeSingle();

      const isOwner = project && project.owner_id === authData.user.id;

      if ((memberErr || !isMember) && !isOwner) {
        await this.supabase.admin.auth.admin.signOut(
          authData.session.access_token,
        );
        this.logger.warn('Login denied: user has no access to selected project');
        throw new UnauthorizedException(
          'Invalid credentials or you do not have access to this project.',
        );
      }
    }

    // Step 3: Fetch user profile
    const { data: profile } = await this.supabase.admin
      .from('users')
      .select('display_name, role')
      .eq('id', authData.user.id)
      .single();

    return {
      access_token: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        display_name: profile?.display_name ?? null,
        role: profile?.role ?? 'protected_user',
        project_id: targetProjectId,
      },
    };
  }

  /**
   * Project-scoped forgot password.
   */
  async forgotPassword(email: string, projectId?: string): Promise<void> {
    const { data: userId } = await this.supabase.admin
      .from('users')
      .select('id')
      .eq('display_name', email.split('@')[0])
      .maybeSingle();

    if (!userId) {
      return;
    }

    if (projectId) {
      const { data: isMember } = await this.supabase.admin.rpc(
        'verify_project_membership',
        {
          p_user_id: userId.id,
          p_project_id: projectId,
        },
      );

      // Check ownership
      const { data: project } = await this.supabase.admin
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle();

      const isOwner = project && project.owner_id === userId.id;

      if (!isMember && !isOwner) {
        this.logger.warn('Enumeration attempt or non-collaborator requested reset');
        return;
      }
    }

    await this.supabase.admin.auth.resetPasswordForEmail(email);
  }

  /**
   * Register a new admin user.
   * Uses Supabase Admin API to create a fully-confirmed user, bypassing email verification.
   */
  async register(dto: RegisterAdmin): Promise<LoginResponse> {
    const sandbox = isSandboxMode();
    if (sandbox) {
      // In sandbox mode, we just return a mock signup/login session
      return {
        access_token: 'sandbox-jwt-token-header.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDMiLCJlbWFpbCI6ImFkbWluQHZleWxvLmlvIiwicm9sZSI6InByb2plY3RfYWRtaW4iLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk5MjM2OTI4fQ.signature',
        user: {
          id: '00000000-0000-0000-0000-000000000003',
          email: dto.email,
          display_name: dto.display_name,
          role: 'project_admin',
          project_id: null,
        },
      };
    }

    // Real database mode: Create confirmed user via Supabase admin auth
    const { data: authData, error: authError } =
      await this.supabase.admin.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          display_name: dto.display_name,
          role: 'project_admin',
        },
      });

    if (authError || !authData.user) {
      this.logger.error(`Registration failed: ${authError?.message}`);
      throw new UnauthorizedException(
        authError?.message || 'Failed to create user account.',
      );
    }

    // Sign in immediately to get a valid user session
    const { data: sessionData, error: sessionError } =
      await this.supabase.admin.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (sessionError || !sessionData.session) {
      throw new UnauthorizedException(
        sessionError?.message || 'Account created but failed to start session.',
      );
    }

    return {
      access_token: sessionData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email ?? '',
        display_name: (authData.user.user_metadata?.display_name as string) || null,
        role: 'project_admin',
        project_id: null,
      },
    };
  }
}

function isSandboxMode(): boolean {
  const url = process.env.SUPABASE_URL ?? '';
  return !url || url.includes('placeholder');
}
