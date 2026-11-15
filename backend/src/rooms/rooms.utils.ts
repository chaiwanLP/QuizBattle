import { randomInt } from 'node:crypto';
import { ROOM_CODE_LENGTH } from './rooms.constants';

/** Six digits, zero-padded, e.g. "042917". */
export function createRoomCode(): string {
  const max = 10 ** ROOM_CODE_LENGTH;
  return randomInt(0, max).toString().padStart(ROOM_CODE_LENGTH, '0');
}

/** "  Somchai   Jaidee " -> "Somchai Jaidee" */
export function normalizeNickname(nickname: string): string {
  return nickname.trim().replace(/\s+/g, ' ');
}
