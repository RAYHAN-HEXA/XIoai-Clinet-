import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '../src/lib/jwt';

const session = { userId: 'user-1', businessId: 'biz-1', role: 'OWNER' as const, jti: 'sess-1' };

describe('session JWT', () => {
  it('round-trips a valid session', () => {
    const token = signSession(session);
    expect(verifySession(token)).toEqual(session);
  });

  it('rejects a tampered token', () => {
    const token = signSession(session);
    const tampered = `${token.slice(0, -3)}abc`;
    expect(verifySession(tampered)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(verifySession('not-a-jwt')).toBeNull();
    expect(verifySession('')).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    // Built by hand with a wrong secret — signature check must fail.
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify(session)).toString('base64url'),
      'invalid-signature'
    ].join('.');
    expect(verifySession(forged)).toBeNull();
  });
});
