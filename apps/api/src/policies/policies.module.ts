import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, SupabaseService, AuditLogsService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
