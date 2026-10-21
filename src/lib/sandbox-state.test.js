import { describe, it, expect } from 'vitest';
import { createSandbox } from './sandbox-state.js';

const OWNER = '00000000-0000-4000-8000-000000000001';
const PRIYA = '00000000-0000-4000-8000-000000000002';
const SAM = '00000000-0000-4000-8000-000000000003';
const clients = ['corvid-analytics', 'pebblebrook-pet-co', 'quarry-climbing'];
const seed = () => ({
  team: {
    members: [
      { fulcra_userid: OWNER, name: 'Morgan', role: 'owner' },
      { fulcra_userid: PRIYA, name: 'Priya', role: 'strategist' }
    ]
  },
  newcomers: [{ fulcra_userid: SAM, name: 'Sam' }],
  shares: [{ client: 'corvid-analytics', user: PRIYA }],
  clients,
  root: '/demo-agency/clients'
});

describe('createSandbox', () => {
  it('starts from the seed: the team, newcomers waiting, and the seeded shares', () => {
    const s = createSandbox(seed());
    expect(s.people().map((p) => [p.name, p.role])).toEqual([
      ['Morgan', 'owner'],
      ['Priya', 'strategist'],
      ['Sam', 'newcomer']
    ]);
    expect(s.visibleTo(PRIYA)).toEqual(['corvid-analytics']);
    expect(s.visibleTo(SAM)).toEqual([]);
    expect(s.accessMap().pending).toEqual(['Sam']);
  });

  it('adds a newcomer to one client and only that client', () => {
    const s = createSandbox(seed());
    const r = s.onboard({ name: 'Sam', id: SAM, slugs: ['pebblebrook-pet-co'] });
    expect(r.shared).toEqual(['pebblebrook-pet-co']);
    expect(s.visibleTo(SAM)).toEqual(['pebblebrook-pet-co']);
    expect(s.people().find((p) => p.id === SAM).role).toBe('strategist');
    expect(s.accessMap().pending).toEqual([]);
    const row = s.accessMap().rows.find((x) => x.id === SAM);
    expect(row.inside).toBe(true);
    expect(row.access).toEqual({ 'pebblebrook-pet-co': 'full' });
  });

  it('revoking takes the client away and leaves other people alone', () => {
    const s = createSandbox(seed());
    s.grant({ slug: 'pebblebrook-pet-co', kind: 'user', id: SAM });
    s.revoke({ slug: 'pebblebrook-pet-co', kind: 'user', id: SAM });
    expect(s.visibleTo(SAM)).toEqual([]);
    expect(s.visibleTo(PRIYA)).toEqual(['corvid-analytics']);
    expect(() => s.revoke({ slug: 'pebblebrook-pet-co', kind: 'user', id: SAM })).toThrow(
      'No share'
    );
  });

  it('refuses bad input the way the live routes do', () => {
    const s = createSandbox(seed());
    expect(() => s.grant({ slug: 'nope', kind: 'user', id: SAM })).toThrow('Unknown client');
    expect(() => s.grant({ slug: 'quarry-climbing', kind: 'user', id: 'not-an-id' })).toThrow(
      'Fulcra ID'
    );
    expect(() => s.grant({ slug: 'quarry-climbing', kind: 'user', id: OWNER })).toThrow(
      'already have access'
    );
  });

  it('reset puts everything back', () => {
    const s = createSandbox(seed());
    s.onboard({ name: 'Sam', id: SAM, slugs: clients });
    s.revoke({ slug: 'corvid-analytics', kind: 'user', id: PRIYA });
    s.reset();
    expect(s.visibleTo(SAM)).toEqual([]);
    expect(s.visibleTo(PRIYA)).toEqual(['corvid-analytics']);
    expect(s.people().find((p) => p.id === SAM).role).toBe('newcomer');
  });
});
