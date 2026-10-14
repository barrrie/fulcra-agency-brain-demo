/**
 * Pure helpers for client brains (m5-3): naming and starter files.
 * No network or Svelte here, so they can be unit-tested.
 */

export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The seven brain files, in reading order. */
export const BRAIN_FILES = [
  { file: 'brief.md', label: 'Brief' },
  { file: 'people.md', label: 'People' },
  { file: 'voice-and-guardrails.md', label: 'Voice & guardrails' },
  { file: 'playbook.md', label: 'Playbook' },
  { file: 'decisions.md', label: 'Decisions' },
  { file: 'log.md', label: 'Log' },
  { file: 'links.md', label: 'Links' }
];

/** "Corvid Analytics!" -> "corvid-analytics". Returns '' when nothing usable is left. */
export function slugify(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

/** Turn a slug into a display name ("salt-and-pepper-studio" -> "Salt & Pepper Studio"). */
export function displayName(slug) {
  return slug
    .split('-')
    .map((w) => (w === 'and' ? '&' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** "corvid-analytics" -> "CA", "quarry" -> "QU", "Salt & Pepper Studio" -> "SP". */
export function initials(name) {
  const words = String(name ?? '')
    .split(/[\s-]+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Starter content for the seven brain files. Neutral prompts only: no pricing
 * or commercial terms, and nothing about any other client.
 */
export function starterFiles(name) {
  const n = String(name).trim();
  return {
    'brief.md': `# ${n}: brief\n\n## What they do\n_One or two sentences on the product and who buys it._\n\n## Why they hired us\n\n## Goals\n- \n\n## Status\n`,
    'people.md': `# ${n}: people\n\n| Name | Role | Notes |\n|---|---|---|\n|  |  |  |\n`,
    'voice-and-guardrails.md': `# ${n}: voice and guardrails\n\n## Voice\n_How they sound, in a few words._\n\n## Say\n- \n\n## Never say\n- \n\n## Topics to avoid\n- \n`,
    'playbook.md': `# ${n}: playbook\n\n## Communities\n- \n\n## What works\n- \n\n## What to try next\n- \n`,
    'decisions.md': `# ${n}: decisions\n\n_Newest first. One line on what was decided, and why._\n`,
    'log.md': `# ${n}: log\n\n_Newest first. Date, what happened, what's next._\n`,
    'links.md': `# ${n}: links\n\n- Assets folder (Google Drive): \n- Website: \n`
  };
}
