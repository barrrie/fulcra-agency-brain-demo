/**
 * Guardrails for brain edits (spec constraints): no pricing / commercial terms.
 * Returns human-readable warnings; empty array means clean.
 */
const PRICING = [
  { re: /\$\s?\d[\d,.]*\s?(k|m)?\b/i, why: 'a dollar amount' },
  { re: /\b(retainer|invoice|per month|\/mo\b|setup fee|billed|net 30)\b/i, why: 'billing or pricing language' }
];

export function lintBrain(text) {
  const hits = [];
  for (const { re, why } of PRICING) {
    const m = re.exec(text || '');
    if (m) hits.push(`Contains ${why} ("${m[0].trim()}"). Brains must not include pricing or commercial terms.`);
  }
  return hits;
}
