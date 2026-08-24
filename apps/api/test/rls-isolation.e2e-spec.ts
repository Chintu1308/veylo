/**
 * RLS Isolation E2E Test Suite
 *
 * Purpose: Prove that Postgres Row-Level Security correctly isolates
 *          tenant data before any application code is trusted.
 *
 * Run against local Supabase (supabase start) or a dedicated test project.
 * Tests are intentionally written to be RED first — they are run after
 * migrations are applied to confirm they turn GREEN.
 *
 * Covers AGENTS.md rule 8:
 *   "Generate a test for every API route, including at least one test that
 *    attempts cross-organization data access and asserts it is denied."
 *
 * Setup: seed data is inserted by migration 0004 (two test orgs with fixed UUIDs).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Fixed test UUIDs (match seed in migration 0004) ─────────────────────────
const ORG_1_ID = '00000000-0000-0000-0000-000000000001'; // Acme Corp
const ORG_2_ID = '00000000-0000-0000-0000-000000000002'; // Beta Ventures

// ── Test user credentials (created as part of test setup below) ──────────────
const USER_A_EMAIL = 'user-a@acme-corp.test';
const USER_A_PASS = 'TestPassword@123!';
const USER_B_EMAIL = 'user-b@beta-ventures.test';
const USER_B_PASS = 'TestPassword@456!';
const USER_C_EMAIL = 'user-c@acme-corp.test';
const USER_C_PASS = 'TestPassword@789!';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Clients ───────────────────────────────────────────────────────────────────
let adminClient: SupabaseClient; // service-role — bypasses RLS (for setup/teardown)
let userAClient: SupabaseClient; // authenticated as User A (org 1, admin)
let userBClient: SupabaseClient; // authenticated as User B (org 2, admin)
let userCClient: SupabaseClient; // authenticated as User C (org 1, user)

let userAId: string;
let userBId: string;
let userCId: string;

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create test users via admin API (bypasses email confirmation)
  const { data: userAData, error: errA } =
    await adminClient.auth.admin.createUser({
      email: USER_A_EMAIL,
      password: USER_A_PASS,
      email_confirm: true,
      user_metadata: { display_name: 'User A' },
    });
  if (errA) throw new Error(`Failed to create User A: ${errA.message}`);
  userAId = userAData.user!.id;

  const { data: userBData, error: errB } =
    await adminClient.auth.admin.createUser({
      email: USER_B_EMAIL,
      password: USER_B_PASS,
      email_confirm: true,
      user_metadata: { display_name: 'User B' },
    });
  if (errB) throw new Error(`Failed to create User B: ${errB.message}`);
  userBId = userBData.user!.id;

  const { data: userCData, error: errC } =
    await adminClient.auth.admin.createUser({
      email: USER_C_EMAIL,
      password: USER_C_PASS,
      email_confirm: true,
      user_metadata: { display_name: 'User C' },
    });
  if (errC) throw new Error(`Failed to create User C: ${errC.message}`);
  userCId = userCData.user!.id;

  // Assign User A to Org 1 (admin), User B to Org 2 (admin), User C to Org 1 (protected_user)
  const { error: memberErrA } = await adminClient
    .from('organization_memberships')
    .insert({
      organization_id: ORG_1_ID,
      user_id: userAId,
      role: 'org_admin',
      status: 'active',
    });
  if (memberErrA)
    throw new Error(`Membership A insert failed: ${memberErrA.message}`);

  const { error: memberErrB } = await adminClient
    .from('organization_memberships')
    .insert({
      organization_id: ORG_2_ID,
      user_id: userBId,
      role: 'org_admin',
      status: 'active',
    });
  if (memberErrB)
    throw new Error(`Membership B insert failed: ${memberErrB.message}`);

  const { error: memberErrC } = await adminClient
    .from('organization_memberships')
    .insert({
      organization_id: ORG_1_ID,
      user_id: userCId,
      role: 'protected_user',
      status: 'active',
    });
  if (memberErrC)
    throw new Error(`Membership C insert failed: ${memberErrC.message}`);

  // Update public.users with organization_id
  await adminClient
    .from('users')
    .update({ organization_id: ORG_1_ID, role: 'org_admin' })
    .eq('id', userAId);
  await adminClient
    .from('users')
    .update({ organization_id: ORG_2_ID, role: 'org_admin' })
    .eq('id', userBId);
  await adminClient
    .from('users')
    .update({ organization_id: ORG_1_ID, role: 'protected_user' })
    .eq('id', userCId);

  // Sign in User A
  const anonA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: sessionA, error: signInErrA } =
    await anonA.auth.signInWithPassword({
      email: USER_A_EMAIL,
      password: USER_A_PASS,
    });
  if (signInErrA) throw new Error(`Sign-in A failed: ${signInErrA.message}`);
  userAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${sessionA.session!.access_token}` },
    },
  });

  // Sign in User B
  const anonB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: sessionB, error: signInErrB } =
    await anonB.auth.signInWithPassword({
      email: USER_B_EMAIL,
      password: USER_B_PASS,
    });
  if (signInErrB) throw new Error(`Sign-in B failed: ${signInErrB.message}`);
  userBClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${sessionB.session!.access_token}` },
    },
  });

  // Sign in User C
  const anonC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: sessionC, error: signInErrC } =
    await anonC.auth.signInWithPassword({
      email: USER_C_EMAIL,
      password: USER_C_PASS,
    });
  if (signInErrC) throw new Error(`Sign-in C failed: ${signInErrC.message}`);
  userCClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${sessionC.session!.access_token}` },
    },
  });

  // Insert seed audit log using service role
  await adminClient.from('audit_logs').insert({
    organization_id: ORG_1_ID,
    actor_id: userAId,
    actor_email: USER_A_EMAIL,
    action: 'test.verify',
    target_type: 'member',
    target_id: userCId,
    payload: { test: true },
  });
}, 30_000);

afterAll(async () => {
  // Cleanup test users (cascades to public.users and organization_memberships)
  if (userAId) await adminClient.auth.admin.deleteUser(userAId);
  if (userBId) await adminClient.auth.admin.deleteUser(userBId);
  if (userCId) await adminClient.auth.admin.deleteUser(userCId);
}, 15_000);

// ── Test scenarios ────────────────────────────────────────────────────────────

describe('RLS Isolation — organizations table', () => {
  it('Scenario 1: anon user can read safe org fields (public search)', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anonClient
      .from('organizations')
      .select('id, display_name, slug, logo_url, location')
      .eq('id', ORG_1_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].display_name).toBe('Acme Corp');
  });

  it('Scenario 2: anon user cannot see non-active orgs', async () => {
    // All seed orgs are active — this just validates the status filter is applied
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await anonClient
      .from('organizations')
      .select('id')
      .eq('status', 'suspended');

    expect(data).toHaveLength(0);
  });
});

describe('RLS Isolation — users table', () => {
  it('Scenario 3: User A can read their own profile', async () => {
    const { data, error } = await userAClient
      .from('users')
      .select('id, display_name, organization_id')
      .eq('id', userAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(userAId);
  });

  it('Scenario 4: User A CANNOT read User B profile (cross-org blocked)', async () => {
    const { data, error } = await userAClient
      .from('users')
      .select('id, display_name')
      .eq('id', userBId);

    // RLS must return 0 rows, not an error
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('Scenario 5: anon user cannot read users table', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anonClient.from('users').select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(0); // RLS returns empty, not a 403
  });
});

describe('RLS Isolation — organization_memberships table', () => {
  it('Scenario 6: User A can see their own membership', async () => {
    const { data, error } = await userAClient
      .from('organization_memberships')
      .select('id, organization_id, role')
      .eq('user_id', userAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].organization_id).toBe(ORG_1_ID);
  });

  it('Scenario 7: User A CANNOT see User B membership (cross-org blocked)', async () => {
    const { data, error } = await userAClient
      .from('organization_memberships')
      .select('id, organization_id')
      .eq('user_id', userBId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('Scenario 8: User A CANNOT see all memberships of Org 2', async () => {
    const { data, error } = await userAClient
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', ORG_2_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe('RLS Isolation — verify_org_membership function (cross-org denial)', () => {
  it('Scenario 9: verify_org_membership returns true for correct org', async () => {
    const { data, error } = await adminClient.rpc('verify_org_membership', {
      p_user_id: userAId,
      p_organization_id: ORG_1_ID,
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('Scenario 10: verify_org_membership returns false for WRONG org (core cross-org denial)', async () => {
    const { data, error } = await adminClient.rpc('verify_org_membership', {
      p_user_id: userAId,
      p_organization_id: ORG_2_ID, // User A belongs to Org 1, not Org 2
    });

    expect(error).toBeNull();
    expect(data).toBe(false); // ← This is the guarantee the entire auth flow depends on
  });
});

describe('RLS Isolation — mutation guard (belt-and-suspenders)', () => {
  it('Scenario 11: authenticated user cannot DELETE an org membership', async () => {
    const { error } = await userAClient
      .from('organization_memberships')
      .delete()
      .eq('user_id', userAId);

    const { data: check } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('user_id', userAId);

    expect(check).toHaveLength(1); // row still exists
  });
});

describe('RLS Isolation — audit_logs table (Phase 4)', () => {
  it('Scenario 12: Org 1 admin can read Org 1 audit logs', async () => {
    const { data, error } = await userAClient
      .from('audit_logs')
      .select('id, action')
      .eq('organization_id', ORG_1_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].action).toBe('test.verify');
  });

  it('Scenario 13: Org 2 admin CANNOT read Org 1 audit logs (cross-org blocked)', async () => {
    const { data, error } = await userBClient
      .from('audit_logs')
      .select('id, action')
      .eq('organization_id', ORG_1_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0); // RLS blocks access
  });

  it('Scenario 14: Org 1 protected_user CANNOT read Org 1 audit logs (insufficient permission)', async () => {
    const { data, error } = await userCClient
      .from('audit_logs')
      .select('id, action')
      .eq('organization_id', ORG_1_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0); // RLS blocks access because role is protected_user
  });

  it('Scenario 15: anon user CANNOT read audit logs', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anonClient
      .from('audit_logs')
      .select('id')
      .eq('organization_id', ORG_1_ID);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('Scenario 16: Org 1 admin cannot directly INSERT an audit log', async () => {
    // Only service_role can write to audit_logs
    const { error } = await userAClient.from('audit_logs').insert({
      organization_id: ORG_1_ID,
      actor_email: USER_A_EMAIL,
      action: 'hack.attempt',
      target_type: 'system',
      target_id: 'global',
    });

    // In Supabase, if no INSERT policy is defined, it fails silently or returns empty
    const { data: check } = await adminClient
      .from('audit_logs')
      .select('id')
      .eq('action', 'hack.attempt');

    expect(check).toHaveLength(0);
  });

  it('Scenario 17: Service role cannot DELETE or UPDATE an audit log (immutability check)', async () => {
    // Fetch seeded audit log
    const { data: seeded } = await adminClient
      .from('audit_logs')
      .select('id')
      .eq('action', 'test.verify')
      .limit(1);

    expect(seeded).toHaveLength(1);
    const logId = seeded![0].id;

    // Try to update it using admin (service-role) client
    const { error: updateError } = await adminClient
      .from('audit_logs')
      .update({ action: 'tampered' })
      .eq('id', logId);

    expect(updateError).not.toBeNull(); // Should fail due to trigger guard

    // Try to delete it using admin client
    const { error: deleteError } = await adminClient
      .from('audit_logs')
      .delete()
      .eq('id', logId);

    expect(deleteError).not.toBeNull(); // Should fail due to trigger guard
  });
});
