import { Module } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, SupabaseService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
