import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Veylo Backend Integrations (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  const testProjectId = '00000000-0000-0000-0000-000000000001';
  const testUserId = '00000000-0000-0000-0000-000000000003';

  beforeAll(async () => {
    // Generate valid sandbox JWT token
    const payload = {
      sub: testUserId,
      email: 'admin@acme-corp.test',
      project_id: testProjectId,
      role: 'project_admin',
      aud: 'authenticated',
      exp: 9999999999,
    };
    
    // Create base64url encoded token
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const pay = Buffer.from(JSON.stringify(payload)).toString('base64url');
    authToken = `${header}.${pay}.signature`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Billing & Subscription Integrations ─────────────────────────────────
  describe('Billing Integration', () => {
    let subId: string;

    it('GET /projects/:projectId/billing/plans -> should return default plans', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/billing/plans`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.find((p: any) => p.id === 'pro')).toBeDefined();
    });

    it('POST /projects/:projectId/billing/subscribe -> should initiate a new subscription', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/billing/subscribe`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan_id: 'pro' })
        .expect(200);

      expect(res.body.project_id).toBe(testProjectId);
      expect(res.body.plan_id).toBe('pro');
      subId = res.body.id;
    });

    it('POST /projects/:projectId/billing/pay -> should process simulated payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/billing/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription_id: subId,
          card_token: 'tok_visa',
        })
        .expect(200);

      expect(res.body.status).toBe('succeeded');
      expect(res.body.amount_cents).toBe(4900);
    });

    it('GET /projects/:projectId/billing/subscription -> should return active sub status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/billing/subscription`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.plan_id).toBe('pro');
      expect(res.body.status).toBe('active');
    });
  });

  // ── 2. Device Trust Integrations ───────────────────────────────────────────
  describe('Device Trust Integration', () => {
    let deviceId: string;

    it('POST /projects/:projectId/devices/register -> should register device', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/devices/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'CEO MacBook Pro',
          os: 'macOS Sonoma',
        })
        .expect(201);

      expect(res.body.name).toBe('CEO MacBook Pro');
      expect(res.body.status).toBe('pending');
      deviceId = res.body.id;
    });

    it('PATCH /projects/:projectId/devices/:id/posture -> should sync posture score', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${testProjectId}/devices/${deviceId}/posture`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          posture_score: 95,
          details: { disk_encrypted: true, firewall_active: true },
        })
        .expect(200);

      expect(res.body.posture_score).toBe(95);
    });

    it('PATCH /projects/:projectId/devices/:id/status -> should allow admin approval', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${testProjectId}/devices/${deviceId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(res.body.status).toBe('approved');
    });
  });

  // ── 3. Policies & Risk Evaluation ──────────────────────────────────────────
  describe('Policies & Risk Engine', () => {
    let resourceId: string;

    it('POST /projects/:projectId/policies/resources -> should create protected resource', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/policies/resources`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Core DB',
          type: 'database',
          endpoint: 'postgresql://db.local:5432',
          sensitivity: 'critical',
        })
        .expect(201);

      expect(res.body.sensitivity).toBe('critical');
      resourceId = res.body.id;
    });

    it('POST /projects/:projectId/policies -> should create security policy', async () => {
      const rules = [
        {
          name: 'Strict Critical DB Rule',
          conditions: [
            { field: 'sensitivity', operator: 'eq', value: 'critical' },
            { field: 'risk_score', operator: 'gt', value: 30 },
          ],
          actions: [
            {
              effect: 'challenge_mfa',
              trigger_alert: true,
            },
          ],
        },
      ];

      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/policies`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Critical Boundary Protection',
          rules,
          is_active: true,
        })
        .expect(201);

      expect(res.body.name).toBe('Critical Boundary Protection');
    });

    it('POST /projects/:projectId/policies/evaluate -> should calculate Zero Trust risk and policy decisions', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/policies/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resource_id: resourceId,
          network_context: {
            source_ip: '10.99.1.5',
            destination_port: 5432,
            protocol: 'tcp',
          },
        })
        .expect(200);

      // Should be blocked or challenge mfa because of critical sensitivity + restricted IP
      expect(res.body.riskScore).toBeGreaterThan(30);
      expect(res.body.decision).toBe('challenge_mfa');
      expect(Array.isArray(res.body.explanation)).toBe(true);
    });
  });

  // ── 4. Incidents & Cryptographic Forensics ──────────────────────────────────
  describe('Incidents & Cryptographic Forensic Ledger', () => {
    let incidentId: string;

    it('POST /projects/:projectId/incidents -> should create incident and start forensic chain', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/incidents`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Unverified Access Log Detected',
          severity: 'high',
        })
        .expect(201);

      expect(res.body.incident_code).toContain('VEY-');
      incidentId = res.body.id;
    });

    it('POST /projects/:projectId/forensics/events -> should append event and build hash chain', async () => {
      const eventData1 = 'Acme Auditor initiated full telemetry audit.';
      const res1 = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/forensics/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          incident_id: incidentId,
          event_data: eventData1,
        })
        .expect(201);

      expect(res1.body.current_hash).toBeDefined();
      expect(res1.body.previous_hash).toBeDefined();
      const hash1 = res1.body.current_hash;

      const eventData2 = 'Acme Auditor concluded telemetry audit successfully.';
      const res2 = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/forensics/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          incident_id: incidentId,
          event_data: eventData2,
        })
        .expect(201);

      expect(res2.body.previous_hash).toBe(hash1);
      expect(res2.body.current_hash).toBeDefined();
    });
  });
});
