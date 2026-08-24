import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── In-Memory Database for Sandbox Mode ──────────────────────────────────────
const mockProjects = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000003',
    name: 'Acme Project',
    slug: 'acme-project',
    status: 'active',
    description: 'Continuous validation telemetry for core boundaries',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    owner_id: '00000000-0000-0000-0000-000000000003',
    name: 'Beta Project',
    slug: 'beta-project',
    status: 'active',
    description: 'Beta stage telemetry pipeline',
  },
];

const mockUsers = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    display_name: 'Acme Admin',
    role: 'org_admin',
    status: 'active',
  },
];

const mockProjectMembers = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    project_id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000003',
    role: 'project_admin',
    status: 'active',
    created_at: new Date().toISOString(),
  },
];

const mockAuditLogs: any[] = [];
const mockPlans = [
  { id: 'free', name: 'Free Tier', price_monthly_cents: 0, max_users: 5, features: ['view_security', 'view_audit_logs'] },
  { id: 'pro', name: 'Pro Plan', price_monthly_cents: 4900, max_users: 50, features: ['view_security', 'view_audit_logs', 'manage_security', 'unlimited_rules'] },
  { id: 'enterprise', name: 'Enterprise Custom', price_monthly_cents: 25000, max_users: 1000, features: ['view_security', 'view_audit_logs', 'manage_security', 'unlimited_rules', 'sso_integration', 'forensic_hash_chain'] }
];
const mockSubscriptions: any[] = [];
const mockPayments: any[] = [];
const mockDevices: any[] = [];
const mockDeviceHistory: any[] = [];
const mockProtectedResources: any[] = [];
const mockSecurityPolicies: any[] = [];
const mockIncidents: any[] = [];
const mockAlerts: any[] = [];
const mockForensicEvents: any[] = [];

// Helper to generate a valid format UUID for database keys
function generateMockUUID(): string {
  const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${hex()}${hex()}-${hex()}-4${hex().substring(1)}-8${hex().substring(1)}-${hex()}${hex()}${hex()}`;
}

// ── Mock Query Builder ────────────────────────────────────────────────────────
class MockQueryBuilder {
  private data: any[];
  private table: string;
  private updatePayload: any = null;
  private isDelete = false;

  constructor(table: string) {
    this.table = table;
    if (table === 'projects') this.data = mockProjects;
    else if (table === 'users') this.data = mockUsers;
    else if (table === 'project_members') this.data = mockProjectMembers;
    else if (table === 'audit_logs') this.data = mockAuditLogs;
    else if (table === 'plans') this.data = mockPlans;
    else if (table === 'subscriptions') this.data = mockSubscriptions;
    else if (table === 'payments') this.data = mockPayments;
    else if (table === 'devices') this.data = mockDevices;
    else if (table === 'device_history') this.data = mockDeviceHistory;
    else if (table === 'protected_resources') this.data = mockProtectedResources;
    else if (table === 'security_policies') this.data = mockSecurityPolicies;
    else if (table === 'incidents') this.data = mockIncidents;
    else if (table === 'alerts') this.data = mockAlerts;
    else if (table === 'forensic_events') this.data = mockForensicEvents;
    else this.data = [];
  }

  select(columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.data = this.data.filter((item) => item[column] === value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const search = pattern.replace(/%/g, '').toLowerCase();
    this.data = this.data.filter((item) =>
      String(item[column] ?? '').toLowerCase().includes(search),
    );
    return this;
  }

  in(column: string, values: any[]) {
    this.data = this.data.filter((item) => values.includes(item[column]));
    return this;
  }

  limit(num: number) {
    this.data = this.data.slice(0, num);
    return this;
  }

  order(column: string, options?: any) {
    return this;
  }

  update(row: any) {
    this.updatePayload = row;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  private applyMutations() {
    if (this.updatePayload) {
      this.data.forEach((item) => {
        Object.keys(this.updatePayload).forEach((key) => {
          item[key] = this.updatePayload[key];
        });
      });
    }
    if (this.isDelete) {
      const globalArray = this.getGlobalArray();
      if (globalArray) {
        this.data.forEach((item) => {
          const idx = globalArray.findIndex((x) => x.id === item.id);
          if (idx !== -1) {
            globalArray.splice(idx, 1);
          }
        });
      }
      this.data = [];
    }
  }

  private getGlobalArray(): any[] | null {
    if (this.table === 'projects') return mockProjects;
    if (this.table === 'users') return mockUsers;
    if (this.table === 'project_members') return mockProjectMembers;
    if (this.table === 'audit_logs') return mockAuditLogs;
    if (this.table === 'plans') return mockPlans;
    if (this.table === 'subscriptions') return mockSubscriptions;
    if (this.table === 'payments') return mockPayments;
    if (this.table === 'devices') return mockDevices;
    if (this.table === 'device_history') return mockDeviceHistory;
    if (this.table === 'protected_resources') return mockProtectedResources;
    if (this.table === 'security_policies') return mockSecurityPolicies;
    if (this.table === 'incidents') return mockIncidents;
    if (this.table === 'alerts') return mockAlerts;
    if (this.table === 'forensic_events') return mockForensicEvents;
    return null;
  }

  async single() {
    this.applyMutations();
    return { data: this.data[0] ?? null, error: this.data[0] ? null : { message: 'Not found' } };
  }

  async maybeSingle() {
    this.applyMutations();
    return { data: this.data[0] ?? null, error: null };
  }

  insert(row: any) {
    const newRow = { id: generateMockUUID(), created_at: new Date().toISOString(), ...row };
    
    // Cryptographic Hash Chain Trigger simulation for forensic_events
    if (this.table === 'forensic_events') {
      const crypto = require('crypto');
      const prevEvent = mockForensicEvents
        .filter((e) => e.project_id === row.project_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const prevHash = prevEvent?.current_hash || '';
      
      newRow.previous_hash = prevHash;
      newRow.current_hash = crypto
        .createHash('sha256')
        .update(`${newRow.event_data}|${prevHash}|${newRow.created_at}`)
        .digest('hex');
    }

    const globalArray = this.getGlobalArray();
    if (globalArray) {
      globalArray.push(newRow);
    }
    this.data = [newRow];

    // Return chainable object matching Supabase's PostgREST builder
    return {
      select: (_columns?: string) => ({
        single: async () => ({ data: newRow, error: null }),
        maybeSingle: async () => ({ data: newRow, error: null }),
        then: (resolve: any) => resolve({ data: [newRow], error: null }),
      }),
      then: (resolve: any) => resolve({ data: newRow, error: null }),
    };
  }

  then(resolve: any) {
    this.applyMutations();
    resolve({ data: this.data, error: null });
  }
}

// ── Mock Supabase Client ──────────────────────────────────────────────────────
const createMockSupabase = () => ({
  auth: {
    signInWithPassword: async (credentials: any) => {
      // Auto-register mock user if not exists to facilitate instant login
      const exists = mockUsers.find((u) => u.display_name.toLowerCase() === credentials.email.split('@')[0]);
      let userId = '00000000-0000-0000-0000-000000000003';

      if (!exists) {
        userId = 'usr-' + Math.random().toString(36).substring(7);
        const newUser = {
          id: userId,
          display_name: credentials.email.split('@')[0],
          role: 'org_admin',
          status: 'active',
        };
        mockUsers.push(newUser);
        mockProjectMembers.push({
          id: 'mem-' + Math.random().toString(36).substring(7),
          project_id: '00000000-0000-0000-0000-000000000001',
          user_id: userId,
          role: 'project_admin',
          status: 'active',
          created_at: new Date().toISOString(),
        });
      } else {
        userId = exists.id;
      }

      return {
        data: {
          user: { id: userId, email: credentials.email },
          session: { access_token: 'mock-jwt-token-value' },
        },
        error: null,
      };
    },
    admin: {
      listUsers: async () => ({
        data: {
          users: mockUsers.map((u) => ({ id: u.id, email: `${u.display_name.toLowerCase()}@veylo.io` })),
        },
        error: null,
      }),
      createUser: async (params: any) => {
        const userId = 'usr-' + Math.random().toString(36).substring(7);
        const newUser = {
          id: userId,
          display_name: params.email.split('@')[0],
          role: 'org_admin',
          status: 'active',
        };
        mockUsers.push(newUser);
        return { data: { user: { id: userId, email: params.email } }, error: null };
      },
    },
  },
  from: (table: string) => new MockQueryBuilder(table),
  rpc: async (fn: string, params: any) => {
    if (fn === 'verify_project_membership') {
      const isMember = mockProjectMembers.some(
        (m) => m.user_id === params.p_user_id && m.project_id === params.p_project_id,
      );
      return { data: isMember, error: null };
    }
    return { data: null, error: null };
  },
} as any);

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _admin!: SupabaseClient;
  private isSandbox = false;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
        'Copy .env.example to apps/api/.env.local and fill in the values.',
      );
    }

    if (url.includes('placeholder')) {
      this.isSandbox = true;
      this.logger.warn('⚠️  Veylo API is running in SANDBOX MODE with in-memory database simulation.');
      this._admin = createMockSupabase();
    } else {
      this._admin = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession:   false,
        },
      });
    }
  }

  get admin(): SupabaseClient {
    return this._admin;
  }

  fromToken(accessToken: string): SupabaseClient {
    if (this.isSandbox) {
      return createMockSupabase();
    }

    const url  = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_ANON_KEY!;

    return createClient(url, anon, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
