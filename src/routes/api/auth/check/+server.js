import { json } from '@sveltejs/kit';
import { DEMO_SANDBOX } from '$lib/server/sandbox.js';

/**
 * Check if user has a valid access token cookie
 * Returns authenticated status without exposing the token to the client
 */
export async function GET({ cookies }) {
  // The sandbox has no sign-in: everyone is signed in as a demo persona.
  if (DEMO_SANDBOX) return json({ authenticated: true });

  const accessToken = cookies.get('fulcra_access_token');

  return json({
    authenticated: !!accessToken
  });
}
