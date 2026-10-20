# Agent notes

- Client brains live at `<AGENCY_ROOT>/clients/<slug>/` in Fulcra. The seven files are brief, people, voice-and-guardrails, playbook, decisions, log and links.
- Demo data in `demo/` may use real brand names (e.g. Starbucks, Delta, McDonald's), but the engagements, people, emails, numbers and Fulcra IDs must be invented. Never put real client, person or account data in this repo, and never imply a real brand is an actual client.
- Never show or store pricing or commercial terms in a brain, and never reference one client inside another client's brain.
- Nothing is shared without explicit owner confirmation.
- Viewer restrictions are enforced server-side. Any new write route must call `requireOwner`.
