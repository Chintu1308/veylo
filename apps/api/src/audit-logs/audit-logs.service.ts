import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Log an administrative or security action.
   * Runs via the admin client to bypass RLS (since regular users cannot write to audit_logs).
   */
  async logAction(params: {
    projectId: string;
    actorId: string | null;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    ipAddress?: string;
    userAgent?: string;
    payload?: Record<string, any>;
  }): Promise<void> {
    const { error } = await this.supabase.admin.from('audit_logs').insert({
      project_id: params.projectId,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      payload: params.payload ?? {},
    });

    if (error) {
      this.logger.error(
        `Failed to write audit log: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Fetch audit logs for a project.
   * The query uses the user's token (fromToken) so RLS handles project-level filtering.
   */
  async getLogs(projectId: string, accessToken: string) {
    const userClient = this.supabase.fromToken(accessToken);
    const { data, error } = await userClient
      .from('audit_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch audit logs: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve audit logs');
    }

    return data;
  }
}
