import { describe, it, expect } from 'vitest';
import { chunkMarkdown, buildMap } from './brain-map.js';

const doc = `---
client: Test Co
---
# Test Co: playbook

## Where we engage
| Sub | Priority |
|---|---|
| r/dogs | P0 |

## Comment pattern
1. Answer the **question** asked.
- No links unless asked,
  even when it's tempting.

A plain paragraph.
`;

describe('chunkMarkdown', () => {
  it('splits bullets, table rows and paragraphs, keeping the heading', () => {
    expect(chunkMarkdown(doc)).toEqual([
      { heading: 'Where we engage', text: 'r/dogs · P0' },
      { heading: 'Comment pattern', text: 'Answer the question asked.' },
      { heading: 'Comment pattern', text: "No links unless asked, even when it's tempting." },
      { heading: 'Comment pattern', text: 'A plain paragraph.' }
    ]);
  });
  it('handles empty files', () => {
    expect(chunkMarkdown(null)).toEqual([]);
  });
});

describe('buildMap', () => {
  const memories = [
    ...['comment threads on reddit', 'reddit comment cadence', 'reddit threads answered'].map(
      (text) => ({
        client: 'a',
        clientName: 'A',
        file: 'playbook.md',
        section: 'Playbook',
        heading: null,
        text
      })
    ),
    ...['legal review of claims', 'legal signs off claims', 'claims need legal'].map((text) => ({
      client: 'b',
      clientName: 'B',
      file: 'decisions.md',
      section: 'Decisions',
      heading: null,
      text
    }))
  ];

  it('groups alike memories and names regions from their words', () => {
    const map = buildMap(memories, { regions: 2 });
    expect(map.regions).toHaveLength(2);
    expect(map.memories).toHaveLength(6);
    const regionOf = (t) => map.memories.find((m) => m.text === t).region;
    expect(regionOf('reddit comment cadence')).toBe(regionOf('reddit threads answered'));
    expect(regionOf('legal review of claims')).toBe(regionOf('claims need legal'));
    expect(regionOf('reddit comment cadence')).not.toBe(regionOf('claims need legal'));
    const nameOf = (t) => map.regions[regionOf(t)].name.toLowerCase();
    expect(['reddit', 'comment', 'threads']).toContain(nameOf('reddit comment cadence'));
    expect(['legal', 'claims']).toContain(nameOf('claims need legal'));
  });

  it('is deterministic', () => {
    expect(buildMap(memories)).toEqual(buildMap(memories));
  });

  it('copes with nothing to map', () => {
    expect(buildMap([])).toEqual({ regions: [], memories: [] });
  });
});
