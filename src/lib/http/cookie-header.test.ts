import { describe, expect, it } from 'vitest';
import { isTruthyCookieFromHeader, readCookieFromHeader } from './cookie-header';

describe('cookie-header (user request simulation)', () => {
  it('readCookieFromHeader finds exact name among several cookies', () => {
    expect(
      readCookieFromHeader('a=1; age_verified=true; b=2', 'age_verified'),
    ).toBe('true');
  });

  it('does not substring-match inside other cookie values', () => {
    expect(readCookieFromHeader('x=age_verified=true; age_verified=no', 'age_verified')).toBe(
      'no',
    );
  });

  it('isTruthyCookieFromHeader matches expected value only', () => {
    expect(isTruthyCookieFromHeader('age_verified=true', 'age_verified', 'true')).toBe(true);
    expect(isTruthyCookieFromHeader('age_verified=false', 'age_verified', 'true')).toBe(false);
    expect(isTruthyCookieFromHeader('', 'age_verified', 'true')).toBe(false);
    expect(isTruthyCookieFromHeader(null, 'age_verified', 'true')).toBe(false);
  });
});
