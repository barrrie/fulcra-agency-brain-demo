# Fulcra Agency Brain (demo)

A SvelteKit app that keeps one "brain" per agency client in Fulcra and controls who on the team can read each one. Built on the Fulcra Svelte app template.

**The demo data is fictional.** The sample clients use real brand names (Starbucks, Delta Air Lines, McDonald's) so the brains feel familiar, but the engagements, people, emails, numbers and Fulcra IDs are invented. None of these companies is a client and none of them is involved with this demo. The agency (Northlight Studio) is invented too.

## What it does

- **Client brains.** Each client is a folder in Fulcra with seven markdown files: brief, people, voice and guardrails, playbook, decisions, log, links. That's what an account strategist needs to pick up a client cold.
- **Asana tab.** If the sync has merged the client's Asana project into the brain (`asana.json` in the client folder), the Asana tab shows how many tasks were merged, how many are coming up, overdue, and left out of the merge (with the reason), as a list or a month calendar. Read-only; Asana stays the source. Tasks that mention pricing are dropped server-side and counted as left out.
- **Owner view.** Edit any file, see every saved version, restore an old one.
- **Teammate view.** Teammates sign in with their own Fulcra account and see only the clients shared with them, read-only. Fulcra's data shares decide what they can see, and the server blocks writes, not just the buttons.
- **Display names.** Everyone sees "Signed in as …" on the home page, using the name on their Fulcra account until they pick their own display name. It's saved in their browser, keyed by Fulcra ID, so there's no new write route for teammates.
- **Map.** Every bullet, row and note across the brains you can read, drawn as one turning field. Memories that say similar things sit together, in regions named from their own words. Recolour by client or section, search to light up matches, click one to open it in its brain.
- **Access page.** One table of who can read which client, inside and outside the team. Grant, revoke, or add a teammate and share several clients in one step.

## Run it

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:6173
```

### Demo mode (default)

`DEMO_FIXTURES=true` serves the fictional brains in `demo/brains/` to anyone who signs in with a Fulcra account. Read-only, no setup in Fulcra.

### Real mode

To try editing, history and sharing against your own Fulcra:

1. Set `DEMO_FIXTURES=false` and `OWNER_USER_ID` to your Fulcra user ID.
2. Copy the fictional brains into your file store:
   ```bash
   FULCRA_ACCESS_TOKEN=... npm run seed          # writes to /demo-agency
   ```
3. Sign in. You're the owner. Share a client from the Access page with a colleague's Fulcra ID and have them sign in.

## Config

| Variable | Default | What it does |
|---|---|---|
| `DEMO_FIXTURES` | `false` | Serve bundled fictional brains, read-only |
| `AGENCY_ROOT` / `PUBLIC_AGENCY_ROOT` | `/demo-agency` | Fulcra folder holding `clients/` and `team.json` |
| `OWNER_USER_ID` | none | Fulcra ID of the owner (server-only) |
| `PUBLIC_APP_NAME` | `Agency Brain` | App title |
| `PUBLIC_AGENCY_NAME` | `Northlight Studio` | Agency name in the UI |
| `PUBLIC_OWNER_NAME` | `the agency owner` | Who teammates ask for access |
| `PUBLIC_AUTH0_DOMAIN`, `PUBLIC_AUTH0_CLIENT_ID`, `PUBLIC_FULCRA_API_ENDPOINT` | see `.env.example` | Fulcra sign-in and API |

## How it works

- **Sign-in:** Auth0 device flow, token in an HTTP-only cookie, all Fulcra calls proxied server-side (`src/lib/user.js`, `src/routes/api/auth/`).
- **Brains:** `src/lib/server/brains.js` lists `<root>/clients/*`, reads the seven files, and saves new versions. Teammates read the owner's files as a share recipient (`fulcra_userid=<owner>`), so Fulcra enforces access.
- **Map:** `src/lib/brain-map.js` (pure, tested) splits brains into memories, groups them with TF-IDF and k-means, and lays them out in 3D. `/api/map` reads only the brains the caller can see; `BrainMap.svelte` draws them on a canvas.
- **Access:** `src/lib/access.js` (pure, tested) builds the who-sees-what map from Fulcra data shares and groups; `src/lib/server/access.js` grants, revokes and onboards.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run seed`
