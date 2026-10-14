# Fulcra Agency Brain (demo)

A SvelteKit app that keeps one "brain" per agency client in Fulcra and controls who on the team can read each one. Built on the Fulcra Svelte app template.

**Everything in this repo is fictional.** The agency (Northlight Studio), its clients (Pebblebrook Pet Co, Corvid Analytics, Quarry Climbing), the people, emails and Fulcra IDs are invented for the demo.

## What it does

- **Client brains.** Each client is a folder in Fulcra with seven markdown files: brief, people, voice and guardrails, playbook, decisions, log, links. That's what an account strategist needs to pick up a client cold.
- **Client cards.** The owner's client list shows, per client, the next meeting, who the brain is shared with (people outside the team in orange, hover for details) and "heat" from overdue Asana tasks. Meetings and task counts come from `<AGENCY_ROOT>/signals.json`, written by an agent with the owner's Calendar and Asana connectors. Counts only, never task names.
- **Owner view.** Edit any file, see every saved version, restore an old one.
- **Teammate view.** Teammates sign in with their own Fulcra account and see only the clients shared with them, read-only. Fulcra's data shares decide what they can see, and the server blocks writes, not just the buttons.
- **Access page.** One table of who can read which client, inside and outside the team. Grant, revoke, or add a teammate and share several clients in one step.
- **Console.** Owner-only, read-only feed of what changed in the owner's Fulcra: their own files, files shared with them, shares they've received and new records in data streams, with an unseen count in the nav.

## Run it

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:6173
```

### Demo mode (default)

`DEMO_FIXTURES=true` serves the fictional agency in `demo/` to anyone who signs in with a Fulcra account. No setup in Fulcra, and nothing is written.

- Everyone starts in the **owner's view**: client cards with meetings, sharing and heat, the Access map and the Console, all from fictional fixtures.
- The **Demo · view as** switch in the top bar flips to a teammate (Priya) to show what sharing hides: she sees two of the three clients, read-only, and no Access or Console.
- Saving, sharing and revoking are refused with a note that it's a demo.
- Meeting times and Console activity are stored relative to now ("next Tuesday 2pm", "3 hours ago"), so the demo never goes stale.

| Fixture | What it feeds |
|---|---|
| `demo/brains/<slug>/*.md` | The seven brain files per client |
| `demo/team.json` | Who is inside the agency |
| `demo/shares.json` | Fulcra data shares and groups, for the Access map and the "Shared with" avatars |
| `demo/signals.json` | Next meetings and Asana counts on the client cards |
| `demo/activity.json` | The Console feed |

### Real mode

To try editing, history and sharing against your own Fulcra:

1. Set `DEMO_FIXTURES=false` and `OWNER_USER_ID` to your Fulcra user ID.
2. Copy the fictional brains, team list and card signals into your file store (nothing is shared):
   ```bash
   FULCRA_ACCESS_TOKEN=... npm run seed          # writes to /demo-agency
   ```
   Meetings in `signals.json` are dated from the day you seed; re-run to refresh them.
3. Sign in. You're the owner. Share a client from the Access page with a colleague's Fulcra ID and have them sign in.

## Config

| Variable | Default | What it does |
|---|---|---|
| `DEMO_FIXTURES` | `false` | Serve bundled fictional brains, read-only |
| `AGENCY_ROOT` / `PUBLIC_AGENCY_ROOT` | `/demo-agency` | Fulcra folder holding `clients/` and `team.json` |
| `OWNER_USER_ID` | none | Fulcra ID of the owner (server-only) |
| `PUBLIC_APP_NAME` | `Agency Brain` | App title |
| `PUBLIC_AGENCY_NAME` | `Northlight Studio` | Agency name in the UI (its initials are the logo) |
| `PUBLIC_OWNER_NAME` | `the agency owner` | Who teammates ask for access |
| `PUBLIC_AUTH0_DOMAIN`, `PUBLIC_AUTH0_CLIENT_ID`, `PUBLIC_FULCRA_API_ENDPOINT` | see `.env.example` | Fulcra sign-in and API |

## How it works

- **Sign-in:** Auth0 device flow, token in an HTTP-only cookie, all Fulcra calls proxied server-side (`src/lib/user.js`, `src/routes/api/auth/`).
- **Brains:** `src/lib/server/brains.js` lists `<root>/clients/*`, reads the seven files, and saves new versions. Teammates read the owner's files as a share recipient (`fulcra_userid=<owner>`), so Fulcra enforces access.
- **Access:** `src/lib/access.js` (pure, tested) builds the who-sees-what map from Fulcra data shares and groups; `src/lib/server/access.js` grants, revokes and onboards.
- **Cards:** `src/lib/signals.js` (pure, tested) turns `signals.json` and the access map into next meeting, heat and avatars; meeting titles that trip the pricing lint are shown as "Meeting".
- **Console:** `src/lib/console.js` (pure, tested) builds the activity feed from Fulcra's updates and dataset endpoints; `src/lib/server/console.js` reads them.
- **Demo:** `src/lib/server/demo.js` serves the fixtures in the same shapes as the real reads; `src/lib/demo.js` (pure, tested) dates them relative to now.
- **Look:** the accent colour is the `--color-brand` token in `src/routes/layout.css`. Change it to re-skin the app.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run seed`
