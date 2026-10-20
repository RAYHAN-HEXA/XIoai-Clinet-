import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { cleanupBusiness, registerOwner, uniqueEmail } from './helpers';

const app = createApp();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupBusiness(id);
  await prisma.$disconnect();
});

describe('auth: registration', () => {
  it('creates a business + OWNER atomically and starts a session', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Reg Owner',
      businessName: 'Reg Biz',
      businessNameZh: '注册公司',
      email,
      password: 'Passw0rd!'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('OWNER');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.join(';')).toContain('xc_session=');
    created.push(res.body.business.id);
  });

  it('rejects a weak password (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X',
      businessName: 'Y',
      email: uniqueEmail('weak'),
      password: 'short'
    });
    expect(res.status).toBe(400);
  });

  it('rejects mismatched confirmation password (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X',
      businessName: 'Y',
      email: uniqueEmail('mismatch'),
      password: 'Passw0rd!',
      confirmPassword: 'Different1!'
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409 without leaking details', async () => {
    const email = uniqueEmail('dup');
    const first = await request(app).post('/api/auth/register').send({ name: 'A', businessName: 'A', email, password: 'Passw0rd!' });
    expect(first.status).toBe(201);
    created.push(first.body.business.id);
    const dup = await request(app).post('/api/auth/register').send({ name: 'B', businessName: 'B', email, password: 'Passw0rd!' });
    expect(dup.status).toBe(409);
    expect(JSON.stringify(dup.body)).not.toContain('Passw0rd');
  });
});

describe('auth: login / logout / me', () => {
  it('logs in, returns the user, and re-fetches role server-side', async () => {
    const { agent, email, businessId } = await registerOwner(app);
    created.push(businessId);

    const fresh = request.agent(app);
    const login = await fresh.post('/api/auth/login').send({ email, password: 'Passw0rd!' });
    expect(login.status).toBe(200);

    const me = await fresh.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.passwordHash).toBeUndefined();

    // role change is enforced on the server on the next request
    await prisma.user.update({ where: { id: me.body.user.id }, data: { role: 'VIEWER' } });
    const again = await fresh.get('/api/auth/me');
    expect(again.body.user.role).toBe('VIEWER');
    void agent;
  });

  it('rejects invalid credentials with a generic 401', async () => {
    const { email, businessId } = await registerOwner(app);
    created.push(businessId);
    const res = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('logs out and the session is revoked server-side', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);

    const before = await agent.get('/api/auth/me');
    expect(before.status).toBe(200);

    const out = await agent.post('/api/auth/logout').set('x-csrf-token', csrf);
    expect(out.status).toBe(204);

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  // Regression: a stale cookie (re-seeded DB, purged demo clone, rotated
  // secret) must still clear — otherwise the web middleware bounces /login
  // back to /dashboard forever and the user can never reach the login page.
  it('logout is idempotent: stale/absent sessions still 204 and clear the cookie', async () => {
    const stale = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'xc_session=stale.token.value');
    expect(stale.status).toBe(204);
    expect(stale.headers['set-cookie']?.join(';')).toContain('xc_session=;');

    const empty = await request(app).post('/api/auth/logout');
    expect(empty.status).toBe(204);
    expect(empty.headers['set-cookie']?.join(';')).toContain('xc_session=;');
  });
});

describe('csrf protection', () => {
  it('blocks a mutation without the CSRF header (403) and allows it with one', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);

    const noToken = await agent.post('/api/recommendations').send({
      type: 'EXTEND_SUPPLIER_TERMS',
      title: 't',
      evidence: [{ a: 1 }],
      impact: {},
      action: {}
    });
    expect(noToken.status).toBe(403);

    const withToken = await agent
      .post('/api/recommendations')
      .set('x-csrf-token', csrf)
      .send({ type: 'EXTEND_SUPPLIER_TERMS', title: 't2', evidence: [{ a: 1 }], impact: {}, action: {} });
    expect(withToken.status).toBe(201);
  });
});

describe('login rate limiting', () => {
  it('returns 429 after too many failed attempts', async () => {
    process.env.RATE_LIMIT_ENABLED = '1';
    try {
      const { email, businessId } = await registerOwner(app);
      created.push(businessId);
      let last = 0;
      for (let i = 0; i < 12; i++) {
        const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
        last = res.status;
        if (last === 429) break;
      }
      expect(last).toBe(429);
    } finally {
      process.env.RATE_LIMIT_ENABLED = '0';
    }
  });
});
