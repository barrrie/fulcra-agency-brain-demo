import { describe, it, expect } from 'vitest';
import { shareReach, buildAccessMap } from './access.js';

const ME = 'owner-id';
const PRIYA = 'priya-id';
const team = [{ fulcra_userid: ME, name: 'Morgan' }, { fulcra_userid: PRIYA, name: 'Priya' }];
const clients = ['starbucks', 'delta-air-lines', 'mcdonalds'];

describe('shareReach', () => {
  it('matches the folder, its ancestors, and share_all_data as full', () => {
    expect(shareReach({ fulcra_data_types: ['file:/demo-agency/clients/mcdonalds'] }, '/demo-agency/clients/mcdonalds')).toBe('full');
    expect(shareReach({ fulcra_data_types: ['filehistory:/demo-agency'] }, '/demo-agency/clients/mcdonalds')).toBe('full');
    expect(shareReach({ share_all_data: true }, '/demo-agency/clients/mcdonalds')).toBe('full');
  });
  it('treats a file inside the folder as partial', () => {
    expect(shareReach({ fulcra_data_types: ['file:/demo-agency/clients/mcdonalds/brief.md'] }, '/demo-agency/clients/mcdonalds')).toBe('partial');
  });
  it('does not match sibling folders that share a name prefix', () => {
    expect(shareReach({ fulcra_data_types: ['file:/demo-agency/clients/mcdonalds-old'] }, '/demo-agency/clients/mcdonalds')).toBe(null);
    expect(shareReach({ fulcra_data_types: ['HeartRate'] }, '/demo-agency/clients/mcdonalds')).toBe(null);
  });
});

describe('buildAccessMap', () => {
  it('is empty when nothing is shared', () => {
    const m = buildAccessMap(clients, [], team);
    expect(m.rows).toEqual([]);
    expect(m.outsideCount).toBe(0);
  });

  it('places team members inside and flags everyone else', () => {
    const shares = [
      { datashare_name: 'mcdonalds-priya', fulcra_data_types: ['file:/demo-agency/clients/mcdonalds'], permissions: [{ allowed_fulcra_userid: PRIYA }] },
      { datashare_name: 'starbucks-brief', fulcra_data_types: ['file:/demo-agency/clients/starbucks/brief.md'], permissions: [{ allowed_fulcra_userid: 'stranger' }] },
      { datashare_name: 'health', fulcra_data_types: ['HeartRate'], permissions: [{ allowed_fulcra_userid: 'unrelated' }] }
    ];
    const m = buildAccessMap(clients, shares, team);
    expect(m.rows.map((r) => r.id)).toEqual(['stranger', PRIYA]); // outside first; unrelated share ignored
    expect(m.rows[0]).toMatchObject({ inside: false, access: { 'starbucks': 'partial' } });
    expect(m.rows[1]).toMatchObject({ inside: true, name: 'Priya', access: { 'mcdonalds': 'full' } });
    expect(m.outsideCount).toBe(1);
  });

  it('flags groups unless every known participant is on the team', () => {
    const shares = [
      { datashare_name: 'g1', fulcra_data_types: ['file:/demo-agency'], group_permissions: [{ allowed_group_id: 'g-team' }, { allowed_group_id: 'g-mixed' }, { allowed_group_id: 'g-unknown' }] }
    ];
    const groups = { 'g-team': { name: 'Team', participants: [ME, PRIYA] }, 'g-mixed': { name: 'Mixed', participants: [ME, 'x'] } };
    const m = buildAccessMap(clients, shares, team, groups);
    const byId = Object.fromEntries(m.rows.map((r) => [r.id, r]));
    expect(byId['g-team'].inside).toBe(true);
    expect(byId['g-mixed'].inside).toBe(false);
    expect(byId['g-unknown']).toMatchObject({ inside: false, membersKnown: false });
    expect(byId['g-team'].access).toEqual({ 'starbucks': 'full', 'delta-air-lines': 'full', 'mcdonalds': 'full' });
  });
});

import { grantBody, revokePlan } from './access.js';

describe('grant and revoke helpers', () => {
  it('builds a folder share for one user', () => {
    const b = grantBody('mcdonalds', 'user', '11111111-2222-3333-4444-555555555555', 'owner');
    expect(b.fulcra_data_types).toEqual(['file:/demo-agency/clients/mcdonalds']);
    expect(b.permissions).toEqual([{ allowed_fulcra_userid: '11111111-2222-3333-4444-555555555555' }]);
    expect(b.group_permissions).toEqual([]);
    expect(b.share_all_data).toBe(false);
  });
  it('deletes a share whose only recipient is revoked', () => {
    expect(revokePlan({ permissions: [{ allowed_fulcra_userid: 'a' }] }, 'user', 'a')).toEqual({ action: 'delete' });
  });
  it('keeps other recipients when revoking one', () => {
    const plan = revokePlan({ permissions: [{ allowed_fulcra_userid: 'a' }, { allowed_fulcra_userid: 'b' }], group_permissions: [{ allowed_group_id: 'g' }] }, 'user', 'a');
    expect(plan).toEqual({ action: 'update', body: { permissions: [{ allowed_fulcra_userid: 'b' }], group_permissions: [{ allowed_group_id: 'g' }] } });
  });
  it('records which shares grant access, for revoke', () => {
    const m = buildAccessMap(['mcdonalds', 'delta-air-lines'], [
      { datashare_id: 's1', datashare_name: 'one', fulcra_data_types: ['file:/demo-agency/clients'], permissions: [{ allowed_fulcra_userid: 'x' }] }
    ], []);
    expect(m.rows[0].via['mcdonalds'][0]).toMatchObject({ id: 's1', recipients: 1, clients: ['mcdonalds', 'delta-air-lines'] });
  });
});

import { addTeammate } from './access.js';

describe('addTeammate', () => {
  const ID = '0e4c2a91-1111-4222-8333-444455556666';
  const base = {
    description: 'x',
    members: [{ fulcra_userid: '00000000-0000-4000-8000-000000000001', name: 'Morgan', role: 'owner' }],
    pending: [{ name: 'Priya', note: 'later' }]
  };
  it('adds the member, clears the matching pending entry, keeps other keys', () => {
    const t = addTeammate(base, { name: ' priya ', id: ID });
    expect(t.description).toBe('x');
    expect(t.members).toHaveLength(2);
    expect(t.members[1]).toEqual({ fulcra_userid: ID, name: 'priya', role: 'strategist' });
    expect(t.pending).toEqual([]);
  });
  it('updates instead of duplicating a known ID', () => {
    const once = addTeammate(base, { name: 'Priya', id: ID });
    const twice = addTeammate(once, { name: 'Priya R', id: ID });
    expect(twice.members).toHaveLength(2);
    expect(twice.members[1].name).toBe('Priya R');
  });
  it('rejects bad IDs, empty names and the owner ID', () => {
    expect(() => addTeammate(base, { name: 'S', id: 'nope' })).toThrow();
    expect(() => addTeammate(base, { name: '  ', id: ID })).toThrow();
    expect(() => addTeammate(base, { name: 'B', id: '00000000-0000-4000-8000-000000000001' })).toThrow();
  });
});
