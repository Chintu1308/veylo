import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, SupabaseService, AuditLogsService],
  exports: [DevicesService],
})
export class DevicesModule {}
