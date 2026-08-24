import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, SupabaseService, AuditLogsService],
  exports: [BillingService],
})
export class BillingModule {}
