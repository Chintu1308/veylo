import { Module, forwardRef } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MongoService } from '../common/mongo.service';
import { IncidentsModule } from '../incidents/incidents.module';
import { SupabaseService } from '../common/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  imports: [forwardRef(() => IncidentsModule)],
  controllers: [MonitoringController],
  providers: [MonitoringService, MongoService, SupabaseService, AuditLogsService],
  exports: [MonitoringService, MongoService],
})
export class MonitoringModule {}
