import { describe, it, expect } from 'vitest';
import { groupFileChanges, streamCounts, collectTypeNames, peerName, buildActivity, receivedShares } from './console.js';

const PEER = '11111111-2222-3333-4444-555555555555';

describe('groupFileChanges', () => {
  it('collapses versions into one item per file', () => {
    const rows = [
      { full_name: '/a/plan.md', state: 'archived', uploaded_at: '2026-10-01T01:00:00Z', archived_at: '2026-10-01T02:00:00Z' },
      { full_name: '/a/plan.md', state: 'uploaded', uploaded_at: '2026-10-01T02:00:00Z', size: 10 },
      { full_name: '/a/new.md', state: 'uploaded', uploaded_at: '2026-10-01T03:00:00Z' },
      { full_name: '/a/gone.md', state: 'archived', uploaded_at: '2026-10-01T00:00:00Z', deleted_at: '2026-10-01T04:00:00Z' }
    ];
    const out = groupFileChanges(rows);
    expect(out.map((f) => [f.name, f.kind])).toEqual([
      ['gone.md', 'Deleted'],
      ['new.md', 'New'],
      ['plan.md', 'Updated']
    ]);
    expect(out.find((f) => f.name === 'plan.md')).toMatchObject({ versions: 2, size: 10, when: '2026-10-01T02:00:00Z' });
  });
});

describe('streamCounts and names', () => {
  it('reads object and array forms', () => {
    expect(streamCounts({ 'MomentAnnotation/x': 4 })).toEqual([{ type: 'MomentAnnotation/x', count: 4 }]);
    expect(streamCounts([{ data_type: 'StepCount', count: 2 }])).toEqual([{ type: 'StepCount', count: 2 }]);
  });
  it('finds names anywhere in a catalog response', () => {
    const names = collectTypeNames(
      { groups: { a: [{ id: 'StepCount', name: 'Steps' }] } },
      [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', base_type: 'MomentAnnotation', name: 'Outbox' }]
    );
    expect(names.StepCount).toBe('Steps');
    expect(names['MomentAnnotation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']).toBe('Outbox');
  });
});

describe('peerName', () => {
  it('prefers the account name, then a bracketed name in a share title', () => {
    expect(peerName(PEER, [{ sharing_fulcra_userid: PEER, sharing_fulcra_user_name: 'Pat Doe' }])).toBe('Pat Doe');
    expect(peerName(PEER, [{ sharing_fulcra_userid: PEER, sharing_fulcra_user_name: PEER, datashare_name: 'Weekly (Pat)' }])).toBe('Pat');
    expect(peerName(PEER, [])).toBe('User 11111111');
  });
});

describe('buildActivity', () => {
  it('marks items newer than last seen and counts them', () => {
    const datasets = [
      { grant_type: 'self' },
      { grant_type: 'user', sharing_fulcra_userid: PEER, sharing_fulcra_user_name: 'Pat', datashare_id: 'd1', datashare_name: 'Notes', file_paths: ['/n/'], created_at: '2026-10-05T00:00:00Z' }
    ];
    expect(receivedShares(datasets)).toHaveLength(1);
    const view = buildActivity({
      own: { file_changes: [{ full_name: '/x.md', state: 'uploaded', uploaded_at: '2026-10-07T00:00:00Z' }], data_types: { StepCount: 3 } },
      peers: [{ uid: PEER, updates: { file_changes: [{ full_name: '/n/a.md', state: 'uploaded', uploaded_at: '2026-10-02T00:00:00Z' }] } }],
      datasets,
      names: { StepCount: 'Steps' },
      lastSeen: Date.parse('2026-10-04T00:00:00Z')
    });
    expect(view.ownFiles[0].unseen).toBe(true);
    expect(view.sharedFiles[0]).toMatchObject({ ownerName: 'Pat', unseen: false });
    expect(view.received[0]).toMatchObject({ fromName: 'Pat', scope: '1 file path', unseen: true });
    expect(view.streams[0]).toMatchObject({ name: 'Steps', count: 3, ownerName: 'You' });
    expect(view.unseen).toBe(2);
  });
});
