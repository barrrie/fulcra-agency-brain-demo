import { describe, it, expect } from 'vitest';
import { lintBrain } from './lint.js';

describe('lintBrain', () => {
  it('passes normal strategist content', () => {
    expect(lintBrain('Max 2–3 comments a week. Elizabeth signs in her own name.')).toEqual([]);
  });
  it('does not flag billing as a content topic', () => {
    expect(lintBrain('Billing transparency pillar; billing complaints go to the help center')).toEqual([]);
  });
  it('flags dollar amounts and billing terms', () => {
    expect(lintBrain('Retainer is $3K/mo')).toHaveLength(2);
    expect(lintBrain('invoice on day 1')).toHaveLength(1);
  });
});
