import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isSandbox = true;

  // In-memory fallback database for sandbox mode
  private mockEvents: any[] = [];

  onModuleInit() {
    const uri = process.env.MONGODB_URI;
    if (uri && !uri.includes('placeholder')) {
      try {
        this.client = new MongoClient(uri);
        this.db = this.client.db('veylo');
        this.isSandbox = false;
        this.logger.log('🍀 Connected to MongoDB Atlas cluster');
      } catch (err: any) {
        this.logger.error('Failed to connect to MongoDB Atlas, falling back to sandbox mode', err.message);
        this.isSandbox = true;
      }
    } else {
      this.logger.warn('⚠️  MongoDB Atlas URI not set. Running in SANDBOX MODE with in-memory network_events collection.');
      this.isSandbox = true;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Insert a network event.
   * Scoped strictly to project_id (mandatory check).
   */
  async insertEvent(event: {
    project_id: string;
    user_id?: string;
    device_id?: string;
    source_ip: string;
    destination_ip: string;
    destination_port: number;
    protocol: string;
    bytes_transferred: number;
    action: 'allow' | 'deny';
    timestamp: Date;
  }): Promise<void> {
    if (!event.project_id) {
      throw new Error('Mutation blocked: project_id is required for network event writes');
    }

    const doc = {
      ...event,
      created_at: event.timestamp || new Date(),
    };

    if (!this.isSandbox && this.db) {
      await this.db.collection('network_events').insertOne(doc);
    } else {
      this.mockEvents.push(doc);
    }
  }

  /**
   * Fetch network events.
   * Scoped strictly to project_id (mandatory check).
   */
  async getEvents(
    projectId: string,
    filter: Record<string, any> = {},
    limit = 100,
  ): Promise<any[]> {
    if (!projectId) {
      throw new Error('Read blocked: project_id filter is required for network event reads');
    }

    const query = {
      ...filter,
      project_id: projectId,
    };

    if (!this.isSandbox && this.db) {
      return this.db
        .collection('network_events')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } else {
      let results = this.mockEvents.filter((e) => e.project_id === projectId);
      
      for (const key of Object.keys(filter)) {
        results = results.filter((e) => e[key] === filter[key]);
      }

      return results
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    }
  }

  async getAllEventsForThreatChecking(filter: Record<string, any> = {}): Promise<any[]> {
    if (!this.isSandbox && this.db) {
      return this.db.collection('network_events').find(filter).toArray();
    } else {
      let results = [...this.mockEvents];
      for (const key of Object.keys(filter)) {
        results = results.filter((e) => e[key] === filter[key]);
      }
      return results;
    }
  }
}
