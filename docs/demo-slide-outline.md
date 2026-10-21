# Fulcra event: 5-minute demo outline

**Speaker:** Barrie, CEO of Kind Stranger
**Audience:** AI-savvy founders and creatives, mostly not engineers
**Shape:** 4 slides (about 1:30), live demo (about 3:00), handoff (about 0:30)

The slides exist to set up the demo. If you're running long, cut talk from the slides, not the demo.

---

## Slide 1: Solo, with a lot of AI (0:20)

**On screen:** "One founder. A dozen AI tools. Zero hand-off problems." Small Kind Stranger logo.

**Say:**
- I run Kind Stranger. We help B2B startups grow on Reddit and sort out their content strategy.
- For a long time it was just me and my AI tools. All the context about every client lived in my head, my chats and my docs, and that worked fine.

## Slide 2: Then I hired someone (0:30)

**On screen:** "My first hire broke my system." Underneath, three short questions:
- What do they need to know about this client?
- What should they never see?
- What happens when they roll off?

**Say:**
- The day I made my first hire, I found out my "system" was me. Nothing was written down in a way someone else could pick up.
- And I didn't want to just open the floodgates. They need the full picture on their clients, nothing on the clients they aren't on, and no commercial terms anywhere.
- When someone moves off a project, that access should go away cleanly, not live on in a forgotten shared folder.

## Slide 3: So I built a company brain on Fulcra (0:25)

**On screen:** A simple picture: one folder per client, seven cards inside (Brief, People, Voice and guardrails, Playbook, Decisions, Log, Links), with a person icon connected to some folders and not others.

**Say:**
- Every client gets a "brain": the seven things someone needs to pick up a client cold.
- It lives in my Fulcra account. Fulcra decides who can read what, so a teammate signs in with their own account and only sees the clients I've shared with them.
- Two house rules are built in: no pricing or commercial terms in a brain, and no client ever mentioned inside another client's brain.

## Slide 4: How it got built (0:15)

**On screen:** "Built with Claude. Data in Fulcra. Still a work in progress."

**Say:**
- I'm not an engineer. I used Claude to help me build the app and to get the client data into Fulcra.
- Honest caveat: getting data *in* is the part I'm still figuring out. Some of it comes across from Asana, a lot of it is still me and Claude writing it up. I'll show you what it does once it's there.

---

## Live demo (about 3:00)

**On screen:** Switch to the app, in demo sandbox mode: scrubbed, with fictional clients (Pebblebrook Pet Co, Corvid Analytics, Quarry Climbing) and a fictional new hire, Sam. Two windows side by side, you on the left, Sam on the right.

**1. What the brain looks like (0:45)**
- Open one client brain as the owner. Click through Brief, Voice and guardrails, and Decisions.
- Point: "If someone new picked this up tomorrow, this is everything they'd need on day one."
- Optional, if time: the Asana tab. Mention that tasks mentioning pricing are left out automatically.

**2. Connect someone to one client (0:45)**
- Flip to the right-hand window, viewing as Sam, who isn't on any project yet. They see nothing except their Fulcra ID. Copy it.
- Back in your window, open Access. Paste Sam's ID into *Add a teammate*, tick **one** client, confirm.
- Point: "That's onboarding someone onto a project. One step, and they get the whole context for that client and nothing else."

**3. See it from their side (0:45)**
- Refresh Sam's window. One client appears, not the other two. Open it: everything's there, marked read-only.
- Point: "They see exactly what I've shared, nothing else, and they can't change the source of truth."

**4. Roll them off (0:45)**
- Back on Access, click *Remove* next to Sam's client and confirm.
- Refresh Sam's window: the brain is gone. Hit home and they're back to nothing.
- Point: "Project's over, access is over. No cleanup, no 'can you remove me from that Drive folder' email."

## Handoff (about 0:30)

**On screen:** Back to a closing slide: "Context is the new onboarding." Your name, Kind Stranger, and where to find you (and The Flesh Report, if you want the plug).

**Say:**
- The takeaway: once you have more than one person, your AI context has to be shareable *and* controllable. Fulcra gave me the second part for free.
- I'd love to hear how others are handling getting data in. Come find me after.
- Hand back to the host.

---

## Prep checklist (not slides)

- Run `npm run demo` on your laptop. That's the demo sandbox: fictional brains, no Fulcra sign-in, sharing simulated in memory. Your real Fulcra account is never touched, and it works offline once it's running.
- Optionally set `PUBLIC_AGENCY_NAME="Kind Stranger"` in `.env`, keeping the clients fictional. Click "change" next to "Signed in as" to show yourself as Barrie rather than Morgan.
- Two windows side by side: a normal one viewing as Morgan (you), a private one where you click **Sam** in the top bar. Each window keeps its own person.
- Hit **Reset** in the top bar (or restart the server) before you go on, so Sam starts with nothing.
- Bump the browser zoom so the back row can read it.
- Have screenshots of each demo step ready anyway, in case the laptop misbehaves.
- Rehearse the demo with a timer. If it runs over, drop the Asana tab first, then trim step 1.
