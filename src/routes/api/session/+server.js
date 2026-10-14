import { json } from '@sveltejs/kit';
import { seesOwnerView, DEMO_FIXTURES } from '$lib/server/brains.js';
import { isOwner } from '$lib/server/harness-owner.js';
import { demoIdentity } from '$lib/server/demo.js';

/**
 * What the nav needs: whether to show the owner's screens, whether this is
 * the demo (and whose view), and whether the real owner can see the harness.
 * Never returns the owner's id.
 */
export function GET({ cookies }) {
  const token = cookies.get('fulcra_access_token');
  return json({
    owner: seesOwnerView(cookies),
    harness: !DEMO_FIXTURES && isOwner(token),
    demo: DEMO_FIXTURES ? demoIdentity(cookies) : null
  });
}
