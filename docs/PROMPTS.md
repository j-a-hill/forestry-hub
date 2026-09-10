# Prompts for building the Campaign Hub

> Kept for the record. Prompts 1–7 below are all built and merged — this file
> is here for the "Iterating after that" section at the bottom, which is still
> the shape to use for changes and bug reports. The repo is
> `j-a-hill/forestry-hub`, not the `forestry-campaign-hub` named below.

Paste these into a Claude Code session on the `forestry-campaign-hub` repo, one at a time. Wait for each to finish, check the screenshots or the PR, then move on. `CLAUDE.md` carries the background, so the prompts stay short.

## Before you start

1. Create an empty **public** GitHub repo, e.g. `j-a-hill/forestry-campaign-hub`.
2. Upload `CLAUDE.md`, `PROMPTS.md` and `hub-mockup.html` to it (Add file → Upload files).
3. Go to claude.ai/code, connect GitHub if you haven't, and start a session on that repo.
4. Paste prompt 1.

To install once there's something to see: Obsidian → Settings → Digital Garden → Plugins → Manage plugins → Install from GitHub → paste the repo URL. To update later, open the same screen and update when the version changes.

---

## 1. Scaffold and test harness

```
Read CLAUDE.md and docs/hub-mockup.html (move the mockup from the repo root into docs/ first).

Set up the plugin skeleton and the local test harness only, no hub features yet:
- garden-plugin.json for id campaign-hub, version 0.1.0, author Jake Hill
- an index.js hook that registers nothing risky yet
- dev/setup.sh, dev/build.sh, dev/shot.mjs and dev/fixtures/notes as described in CLAUDE.md, with a realistic fixture set (home note, 6+ jobs across all statuses, 4+ sessions, 5+ characters including one dead, 4 facilities, one note per hub page type, plus the edge cases)
- .gitignore for .garden/ and screenshots
- a README stub

Before writing fixtures, check how the obsidian-digital-garden publisher shapes frontmatter (FrontmatterCompiler.ts, including resolveLinkProperties) so the fixtures match what Forestry actually receives. Summarise what you found.

Run setup and build, confirm there are no [plugins] warnings, and take a screenshot of the plain fixture home page. Commit on a branch and open a PR.
```

## 2. Data layer

```
Add the data layer in index.js: one filter (e.g. campaignHub) that takes collections.note and returns plain objects for jobs, sessions, characters (with expedition counts computed from session parties), facilities, hub pages and the home note's hub settings. Handle missing fields, lists given as strings, resolved wikilink properties and hidden notes. Every note must be processed inside try/catch.

Add a small Node test (node --test, no new dependencies) that runs the filter against the fixtures, including the edge cases.

Then render a temporary debug block on the home page that dumps counts per type, build, and screenshot to prove the data reaches the templates. Remove the debug block before opening the PR.
```

## 3. Home dashboard: banner, headlines, rumour board, expedition log

```
Build the first half of the home dashboard in index.beforeContent, gated on the home note having hub: home:
- banner with title, world-date and the next-session card (hidden client-side once the date has passed)
- "The valley right now" from headlines (bold/italic only)
- rumour board: open and taken jobs as pinned notices, capped by a setting (default 4), linking to the hub: jobs page if one exists
- expedition log: latest sessions (setting, default 3), hex chips linking to <map note url>?hex=N when a note with hexmap: true exists, plain text otherwise

Match docs/hub-mockup.html for layout and feel, using the site's own theme colours where possible so it works on the current Red Graphite theme. Empty sections must not render. Screenshot at 1280 and 400 px and compare with the mockup. PR when it looks right.
```

## 4. Home dashboard: map card, overheard, rebuild tracker, adventurers

```
Finish the home dashboard:
- map card: fetch /hexcrawl-map.json client-side, show explored count, map image and link, hide the card if the fetch fails
- overheard: rumours from the home note, setting for all vs 3 at random
- rebuilding Fellgard: facility progress bars, red when warn is true
- adventurers: alive first, then retired/missing, then dead (struck through with fate), expedition counts

Test with the hexcrawl-map plugin both installed and absent (clone j-a-hill/forestry-hexmap into .garden/src/plugins/hexcrawl-map for the installed case). Screenshots at both widths, then PR.
```

## 5. Hub pages

```
Add the four hub pages rendered in notes.afterContent for notes with hub: jobs | log | roster | fort:
- jobs: grouped Open / Taken / Done / Failed, each job shows patron, reward, hex chips, summary, link to the note
- log: all sessions newest first, grouped by month
- roster: grouped by status, with class, level, origin, player and expedition count; each character links to their note and lists the sessions they were on
- fort: all facilities with bars and state

On a job, session or character note itself, add a small info strip under the title (notes.beforeContent) showing its key properties, e.g. status and patron for a job, party and hexes for a session.

Screenshots of each page at both widths, then PR.
```

## 6. Theme (optional)

```
Add the optional campaign theme from CLAUDE.md, behind a boolean setting that defaults to off: a parchment/dark palette matching docs/hub-mockup.html, Cinzel for headings and EB Garamond for body text with serif fallbacks, and styled callouts for quote/handout/rumour. It must not break the hexcrawl map, search, the file tree or code blocks. Screenshot the home page, a normal lore note, the map note and a hub page with the theme on and off. PR.
```

## 7. Settings pass and README

```
Review every setting for sensible defaults and clear descriptions (they show in Obsidian's plugin settings). Update README.md with a screenshot, a short "how to use" for each note type with copy-paste frontmatter, and the settings table. Bump to 1.0.0 once it's all merged.
```

---

## Iterating after that

Use this shape for changes and bug reports:

```
On the live site <what you saw, page URL, phone or desktop>. Expected <what should happen>.
Reproduce it in the fixtures first, fix it on a branch, screenshot before and after, bump the patch version, PR.
```

Ideas for later:
- signup list pulled from a `signups:` property instead of a bare number
- "last seen" on characters from their newest session
- job notes linking to the session that completed them (`completed-in: [[...]]`)
- a printable one-page session handout
