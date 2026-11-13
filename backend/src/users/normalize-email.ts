/**
 * Emails are stored and compared in one canonical form, so "Foo@Example.com"
 * and "foo@example.com" can't create two accounts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}
