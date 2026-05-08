import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSuperheroApiBase, SEARCH_PAGE_LIMIT } from './constants';

describe('constants', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('SEARCH_PAGE_LIMIT is stable grid size', () => {
    expect(SEARCH_PAGE_LIMIT).toBe(36);
  });

  it('getSuperheroApiBase uses SUPERHERO_API_TOKEN', () => {
    vi.stubEnv('SUPERHERO_API_TOKEN', 'test-token');
    expect(getSuperheroApiBase()).toBe('https://superheroapi.com/api/test-token');
  });
});
