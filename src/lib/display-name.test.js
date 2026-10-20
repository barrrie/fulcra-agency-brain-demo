import { describe, it, expect } from 'vitest';
import {
  cleanDisplayName,
  fulcraName,
  resolveName,
  loadDisplayName,
  saveDisplayName,
  createDisplayNames
} from './display-name.js';
import { get } from 'svelte/store';

const ID = '00000000-0000-4000-8000-000000000002';

function memoryStorage() {
  /** @type {Map<string, string>} */
  const data = new Map();
  return {
    getItem: (/** @type {string} */ k) => data.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, String(v)),
    removeItem: (/** @type {string} */ k) => data.delete(k),
    data
  };
}

describe('resolveName', () => {
  it('prefers the chosen display name over the Fulcra name', () => {
    expect(resolveName('Pri', { name: 'Priya Raman' })).toBe('Pri');
  });
  it('falls back to the Fulcra name when no display name is set', () => {
    expect(resolveName('', { name: 'Priya Raman' })).toBe('Priya Raman');
    expect(resolveName('   ', { email: 'priya@example.com' })).toBe('priya@example.com');
  });
  it('says "you" when nothing is known', () => {
    expect(resolveName(null, {}, {})).toBe('you');
  });
});

describe('fulcraName', () => {
  it('uses the Fulcra profile name first, then Auth0 fields', () => {
    expect(fulcraName({ name: 'Auth0 Name' }, { name: 'Fulcra Name' })).toBe('Fulcra Name');
    expect(fulcraName({ nickname: 'pri', email: 'p@example.com' }, {})).toBe('pri');
    expect(fulcraName({}, {})).toBe(null);
  });
});

describe('cleanDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanDisplayName('  Priya   R ')).toBe('Priya R');
    expect(cleanDisplayName(undefined)).toBe('');
  });
  it('rejects names over 60 characters', () => {
    expect(() => cleanDisplayName('x'.repeat(61))).toThrow();
  });
});

describe('save and load', () => {
  it('round-trips per Fulcra ID and clears on empty', () => {
    const s = memoryStorage();
    expect(saveDisplayName(ID, ' Pri ', s)).toBe('Pri');
    expect(loadDisplayName(ID, s)).toBe('Pri');
    expect(loadDisplayName('someone-else', s)).toBe('');
    saveDisplayName(ID, '', s);
    expect(s.data.size).toBe(0);
  });
  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };
    expect(loadDisplayName(ID, broken)).toBe('');
    expect(saveDisplayName(ID, 'Pri', broken)).toBe('Pri');
  });
});

describe('displayNames store', () => {
  it('loads once per ID and shares saves with every subscriber', () => {
    const s = memoryStorage();
    s.setItem(`displayName:${ID}`, 'Pri');
    const names = createDisplayNames(s);
    names.load(ID);
    expect(get(names)[ID]).toBe('Pri');
    names.save(ID, 'Priya R');
    expect(get(names)[ID]).toBe('Priya R');
    expect(s.getItem(`displayName:${ID}`)).toBe('Priya R');
  });
});
