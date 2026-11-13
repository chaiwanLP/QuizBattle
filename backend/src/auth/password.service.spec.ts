import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('verifies the password it hashed', async () => {
    const hash = await passwords.hash('correct horse battery staple');
    await expect(
      passwords.verify('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await passwords.hash('correct horse battery staple');
    await expect(passwords.verify('wrong password', hash)).resolves.toBe(
      false,
    );
  });

  it('produces a different hash every time (random salt)', async () => {
    const [first, second] = await Promise.all([
      passwords.hash('same password'),
      passwords.hash('same password'),
    ]);
    expect(first).not.toBe(second);
  });

  it('rejects malformed hashes instead of throwing', async () => {
    await expect(passwords.verify('anything', 'not-a-hash')).resolves.toBe(
      false,
    );
    await expect(passwords.verify('anything', 'scrypt$x$8$1$a$b')).resolves.toBe(
      false,
    );
  });

  it('flags hashes made with older parameters for rehashing', async () => {
    const hash = await passwords.hash('password');
    expect(passwords.needsRehash(hash)).toBe(false);
    expect(passwords.needsRehash('scrypt$1024$8$1$c2FsdA==$aGFzaA==')).toBe(
      true,
    );
  });
});
