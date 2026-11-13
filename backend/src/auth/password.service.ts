import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';

// OWASP-recommended scrypt parameters (N=2^15 keeps a single hash around
// 32 MiB / tens of milliseconds, which is a good fit for a game backend).
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

interface ParsedHash {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  hash: Buffer;
}

function deriveKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  const options: ScryptOptions = {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEMORY,
  };

  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/**
 * Password hashing with Node's built-in scrypt (no native dependency).
 * Stored format: scrypt$N$r$p$saltBase64$hashBase64
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const hash = await deriveKey(
      password,
      salt,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
    );

    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64'),
      hash.toString('base64'),
    ].join('$');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parsed = this.parse(storedHash);
    if (!parsed) return false;

    const hash = await deriveKey(
      password,
      parsed.salt,
      parsed.cost,
      parsed.blockSize,
      parsed.parallelization,
    );

    return hash.length === parsed.hash.length && timingSafeEqual(hash, parsed.hash);
  }

  /** True when the stored hash was made with weaker parameters than today's. */
  needsRehash(storedHash: string): boolean {
    const parsed = this.parse(storedHash);
    return (
      !parsed ||
      parsed.cost !== COST ||
      parsed.blockSize !== BLOCK_SIZE ||
      parsed.parallelization !== PARALLELIZATION
    );
  }

  private parse(storedHash: string): ParsedHash | null {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return null;

    const cost = Number(parts[1]);
    const blockSize = Number(parts[2]);
    const parallelization = Number(parts[3]);
    if (
      !Number.isInteger(cost) ||
      !Number.isInteger(blockSize) ||
      !Number.isInteger(parallelization) ||
      cost <= 0 ||
      blockSize <= 0 ||
      parallelization <= 0
    ) {
      return null;
    }

    const salt = Buffer.from(parts[4], 'base64');
    const hash = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || hash.length === 0) return null;

    return { cost, blockSize, parallelization, salt, hash };
  }
}
