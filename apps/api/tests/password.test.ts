import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password hashing', () => {
  it('hashes a password and verifies the correct one', async () => {
    const hash = await hashPassword('S3curePass!');
    expect(hash).not.toBe('S3curePass!');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword('S3curePass!', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('S3curePass!');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('salts: same password twice → different hashes', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});
