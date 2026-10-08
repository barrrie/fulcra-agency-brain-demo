# Fulcra Agency Brain (demo)

A SvelteKit app that keeps one "brain" per agency client in Fulcra and controls who on the team can read each one. Built on the Fulcra Svelte app template.

**Everything in this repo is fictional.** The agency (Northlight Studio), its clients (Pebblebrook Pet Co, Corvid Analytics, Quarry Climbing), the people, emails and Fulcra IDs are invented for the demo.

## What it does

- **Client brains.** Each client is a folder in Fulcra with seven markdown files: brief, people, voice and guardrails, playbook, decisions, log, links. That's what an account strategist needs to pick up a client cold.
- **Owner view.** Edit any file, see every saved version, restore an old one.
- **Teammate view.** Teammates sign in with their own Fulcra account and see only the clients shared with them, read-only. Fulcra's data shares decide what they can see, and the server blocks writes, not just the buttons.
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
- **Access:** `src/lib/access.js` (pure, tested) builds the who-sees-what map from Fulcra data shares and groups; `src/lib/server/access.js` grants, revokes and onboards.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run seed`
