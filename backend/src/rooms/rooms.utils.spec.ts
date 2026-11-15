import { createRoomCode, normalizeNickname } from './rooms.utils';

describe('room helpers', () => {
  it('generates six digit codes, including leading zeros', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(createRoomCode()).toMatch(/^\d{6}$/);
    }
  });

  it('collapses extra whitespace in nicknames', () => {
    expect(normalizeNickname('  Somchai   Jaidee ')).toBe('Somchai Jaidee');
  });
});
