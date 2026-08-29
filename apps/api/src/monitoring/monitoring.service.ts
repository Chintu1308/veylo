import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { MongoService } from '../common/mongo.service';
import { IncidentsService } from '../incidents/incidents.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @Inject(MongoService)
    private readonly mongo: MongoService,
    @Inject(forwardRef(() => IncidentsService))
    private readonly incidentsService: IncidentsService,
  ) {}

  async listEvents(projectId: string, filter: Record<string, any> = {}, limit = 100) {
    return this.mongo.getEvents(projectId, filter, limit);
  }

  async logNetworkEvent(
    projectId: string,
    event: {
      user_id?: string;
      device_id?: string;
      source_ip: string;
      destination_ip: string;
      destination_port: number;
      protocol: string;
      bytes_transferred: number;
      action: 'allow' | 'deny';
    },
  ) {
    const timestamp = new Date();
    
    await this.mongo.insertEvent({
      project_id: projectId,
      ...event,
      timestamp,
    });

    await this.detectThreats(projectId, event, timestamp);
  }

  private async detectThreats(
    projectId: string,
    currentEvent: any,
    now: Date,
  ) {
    const sourceIp = currentEvent.source_ip;
    const userId = currentEvent.user_id;

    const allRecent = await this.mongo.getEvents(projectId, {}, 1000);

    // 1. Traffic Spike Detection
    const tenSecAgo = new Date(now.getTime() - 10000);
    const ipEventsLast10s = allRecent.filter(
      (e) => e.source_ip === sourceIp && new Date(e.timestamp) >= tenSecAgo,
    );
    if (ipEventsLast10s.length > 100) {
      await this.triggerThreatAlert(
        projectId,
        'Traffic Spike Anomaly',
        `Source IP ${sourceIp} sent ${ipEventsLast10s.length} requests in under 10 seconds (threshold: 100).`,
        'high',
      );
    }

    // 2. Rapid IP Change Detection
    if (userId) {
      const fiveMinAgo = new Date(now.getTime() - 300000);
      const userRecent = allRecent.filter(
        (e) => e.user_id === userId && new Date(e.timestamp) >= fiveMinAgo,
      );
      const distinctIps = new Set(userRecent.map((e) => e.source_ip));
      if (distinctIps.size > 1) {
        await this.triggerThreatAlert(
          projectId,
          'Rapid IP Change Detected',
          `User session ${userId} accessed from multiple locations: ${Array.from(distinctIps).join(', ')} in under 5 minutes.`,
          'critical',
        );
      }
    }

    // 3. Brute Force Login Detection
    const isLoginAttempt = currentEvent.destination_port === 3001 && currentEvent.action === 'deny';
    if (isLoginAttempt) {
      const oneMinAgo = new Date(now.getTime() - 60000);
      const failedLogins = allRecent.filter(
        (e) =>
          e.source_ip === sourceIp &&
          e.destination_port === 3001 &&
          e.action === 'deny' &&
          new Date(e.timestamp) >= oneMinAgo,
      );
      if (failedLogins.length >= 5) {
        await this.triggerThreatAlert(
          projectId,
          'Brute Force Attack Attempt',
          `Multiple login failures (${failedLogins.length}) detected from source IP ${sourceIp} in under 60 seconds.`,
          'critical',
        );
      }
    }

    // 4. Port Scan Pattern Detection
    const thirtySecAgo = new Date(now.getTime() - 30000);
    const scannerEvents = allRecent.filter(
      (e) => e.source_ip === sourceIp && new Date(e.timestamp) >= thirtySecAgo,
    );
    const distinctPorts = new Set(scannerEvents.map((e) => e.destination_port));
    if (distinctPorts.size >= 10) {
      await this.triggerThreatAlert(
        projectId,
        'Port Scan Activity',
        `Source IP ${sourceIp} probed ${distinctPorts.size} distinct ports in under 30 seconds.`,
        'medium',
      );
    }

    // 5. Restricted Destination Access
    const isRestrictedDest =
      currentEvent.destination_ip.startsWith('10.99.') ||
      currentEvent.destination_ip.startsWith('192.168.99.');
    if (isRestrictedDest) {
      await this.triggerThreatAlert(
        projectId,
        'Restricted Destination Access',
        `Unapproved network packet attempt routing to restricted segment: ${currentEvent.destination_ip}.`,
        'critical',
      );
    }

    // 6. Repeated Access Denial
    const tenMinAgo = new Date(now.getTime() - 600000);
    const deniedEvents = allRecent.filter(
      (e) =>
        e.action === 'deny' &&
        (e.user_id === userId || e.source_ip === sourceIp) &&
        new Date(e.timestamp) >= tenMinAgo,
    );
    if (deniedEvents.length >= 3) {
      await this.triggerThreatAlert(
        projectId,
        'Repeated Access Denial',
        `User/IP triggered ${deniedEvents.length} distinct policy rejections in under 10 minutes.`,
        'high',
      );
    }

    // 7. Resource Enumeration Detection
    if (userId) {
      const oneMinAgo = new Date(now.getTime() - 60000);
      const userAccesses = allRecent.filter(
        (e) => e.user_id === userId && new Date(e.timestamp) >= oneMinAgo,
      );
      const distinctResources = new Set(userAccesses.map((e) => e.destination_ip));
      if (distinctResources.size >= 5) {
        await this.triggerThreatAlert(
          projectId,
          'Resource Enumeration Attempt',
          `Analyst alert: user ${userId} scanned/queried ${distinctResources.size} distinct resources within 60 seconds.`,
          'high',
        );
      }
    }
  }

  private async triggerThreatAlert(
    projectId: string,
    title: string,
    desc: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ) {
    this.logger.warn(`🚨 Threat Detected: [${title}] — ${desc}`);

    const incident = await this.incidentsService.createIncident(
      projectId,
      `Threat Incident: ${title}`,
      severity,
    );

    await this.incidentsService.createAlert(
      projectId,
      title,
      desc,
      severity,
      incident.id,
    );
  }
}
