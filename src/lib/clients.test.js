import { describe, it, expect } from 'vitest';
import { slugify, initials, starterFiles, displayName, SLUG } from './clients.js';
import { lintBrain } from './lint.js';

const BRAIN = [
  'brief.md',
  'people.md',
  'voice-and-guardrails.md',
  'playbook.md',
  'decisions.md',
  'log.md',
  'links.md'
];

describe('slugify', () => {
  it('makes folder-safe slugs that match the existing brains', () => {
    expect(slugify('Corvid Analytics!')).toBe('corvid-analytics');
    expect(slugify('  Pebblebrook Pet Co ')).toBe('pebblebrook-pet-co');
    expect(slugify('Café & Co.')).toBe('cafe-and-co');
    expect(slugify('Acme.io')).toBe('acme-io');
  });
  it('returns empty for names with nothing usable', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });
  it('blocks path tricks and stays within the server pattern', () => {
    expect(slugify('../../etc/passwd')).toBe('etc-passwd');
    expect(SLUG.test(slugify('x'.repeat(200)))).toBe(true);
    expect(SLUG.test(slugify('a b-'.repeat(40)))).toBe(true);
  });
});

describe('initials', () => {
  it('uses two letters', () => {
    expect(initials('Corvid Analytics')).toBe('CA');
    expect(initials('Quarry')).toBe('QU');
    expect(initials('')).toBe('?');
    expect(initials('Salt & Pepper Studio')).toBe('SP');
  });
});

describe('starterFiles', () => {
  const files = starterFiles('Harbor Labs');
  it('creates exactly the seven brain files', () => {
    expect(Object.keys(files).sort()).toEqual([...BRAIN].sort());
  });
  it('names the client and passes the pricing lint', () => {
    for (const f of BRAIN) {
      expect(files[f]).toContain('Harbor Labs');
      expect(lintBrain(files[f])).toEqual([]);
    }
  });
  it('mentions no other client', () => {
    const all = Object.values(files).join('\n').toLowerCase();
    for (const other of ['corvid', 'pebblebrook', 'quarry', 'fulcra'])
      expect(all).not.toContain(other);
  });
});

describe('displayName', () => {
  it('title-cases slugs and writes "and" as &', () => {
    expect(displayName('corvid-analytics')).toBe('Corvid Analytics');
    expect(displayName('harbor-labs')).toBe('Harbor Labs');
    expect(displayName('salt-and-pepper-studio')).toBe('Salt & Pepper Studio');
  });
});
