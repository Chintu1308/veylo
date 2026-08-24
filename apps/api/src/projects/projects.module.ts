import { Module, Global } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Global()
@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, SupabaseService, AuditLogsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
