import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, SupabaseService, AuditLogsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
