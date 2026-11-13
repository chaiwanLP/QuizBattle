import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import type { JwtPayload, PublicUser } from './auth.types';
import { PasswordService } from './password.service';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  /** Hashed once, then used to keep failed logins for unknown emails slow. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  /** Returns the user when the email/password pair is valid, otherwise null. */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    const found = await this.users.findCredentialsByEmail(email);

    if (!found) {
      // Same work as a real check, so response time doesn't reveal whether
      // the email is registered.
      await this.passwords.verify(password, await this.getDummyHash());
      return null;
    }

    const valid = await this.passwords.verify(password, found.passwordHash);
    if (!valid) return null;

    if (this.passwords.needsRehash(found.passwordHash)) {
      await this.users.updatePasswordHash(
        found.id,
        await this.passwords.hash(password),
      );
    }

    return {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
      createdAt: found.createdAt,
    };
  }

  async verifyToken(token: string): Promise<PublicUser | null> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }

    return this.users.findById(payload.sub);
  }

  signToken(user: PublicUser): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, email: user.email });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwords.hash('dummy-password-for-timing');
    return this.dummyHash;
  }
}
