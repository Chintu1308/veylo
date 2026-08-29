import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { BillingModule } from './billing/billing.module';
import { DevicesModule } from './devices/devices.module';
import { PoliciesModule } from './policies/policies.module';
import { IncidentsModule } from './incidents/incidents.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { EventsModule } from './events/events.module';

/**
 * Root application module.
 *
 * Rate limiting (AGENTS.md rule: "Do not skip the rate limiter in front of
 * /auth/login even though brute-force detection also exists downstream"):
 *   - Global: 100 req / 60s per IP (loose catch-all)
 *   - /auth/login: 10 req / 60s per IP (enforced by controller-level override)
 *
 * Upstash Redis storage for the rate limiter is configured in main.ts.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000, // 60 seconds
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10, // Strict limit for auth endpoints
      },
    ]),
    AuthModule,
    ProjectsModule,
    AuditLogsModule,
    BillingModule,
    DevicesModule,
    PoliciesModule,
    IncidentsModule,
    MonitoringModule,
    EventsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
