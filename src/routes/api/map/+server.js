import { json, error } from '@sveltejs/kit';
import { AGENCY_NAME } from '$lib/config.js';
import { requireSignedIn, listClients, readBrain } from '$lib/server/brains.js';
import { chunkMarkdown, buildMap } from '$lib/brain-map.js';

/**
 * Every memory the caller can read, laid out as one map. Viewers only get the
 * clients shared with them, because each brain is read as that viewer.
 */
export async function GET({ cookies }) {
  const { token, asUser } = requireSignedIn(cookies);
  const slugs = await listClients(token, asUser);
  const results = await Promise.allSettled(slugs.map((slug) => readBrain(token, slug, asUser)));

  const brains = [];
  for (const r of results) {
    if (r.status === 'fulfilled') brains.push(r.value);
    else if (r.reason?.status === 401)
      throw error(401, 'Session expired or invalid. Sign in again.');
  }

  const memories = brains.flatMap((b) =>
    b.sections.flatMap((s) =>
      chunkMarkdown(s.content).map((m) => ({
        client: b.slug,
        clientName: b.name,
        file: s.file,
        section: s.label,
        ...m
      }))
    )
  );

  // Client and agency names are everywhere; leave them out so regions are about topics.
  const map = buildMap(memories, { stopwords: [...brains.map((b) => b.name), AGENCY_NAME] });
  return json({
    clients: brains.map((b) => ({ slug: b.slug, name: b.name })),
    ...map
  });
}
