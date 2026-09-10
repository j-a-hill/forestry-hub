# Campaign Hub – Digital Garden plugin

Repo instructions for Claude Code. Read this before doing anything.

## What this is

A plugin for a Digital Garden site that turns it into a hub for a West Marches D&D 5e campaign ("Tales from Fellgard", set in the valley of Dunvale). The site is https://dunvale.forestry.md, hosted on Forestry.md and published from Obsidian with the Digital Garden plugin. The owner (Jake) runs the game; players use the site to check jobs, the map, past expeditions and characters before signing up for a session.

The target look and content are in `docs/hub-mockup.html`. Treat it as the design brief, not code to copy: the real thing has to live inside the Digital Garden layout.

A sibling plugin, `hexcrawl-map` (repo `j-a-hill/forestry-hexmap`), already provides the fog-of-war hex map. This plugin must work with or without it installed.

## How garden plugins work (the parts that matter)

Template: https://github.com/oleeskild/digitalgarden (Eleventy 3, Nunjucks). Reference docs: the `garden-plugin-author` skill if available, otherwise `src/plugins/dg-*` and `src/helpers/pluginLoader.js` in the template.

- A plugin is a repo with `garden-plugin.json` at the root. Obsidian installs it by copying every file in the repo (except `.git*`, `.github`, `node_modules`) into `src/plugins/<id>/` of the garden. Limits: 2 MB per file, 10 MB total. Eleventy's input is `src/site`, so nothing in the plugin dir is rendered as a page.
- Installer ref: latest GitHub **release** tag if one exists, otherwise the default branch. **Do not create GitHub releases** – that would freeze installs at the release. `main` is what gets installed.
- Manifest fields: `id` (must be `campaign-hub`), `name`, `version`, `description`, `author`, plus optional `slots`, `styles`, `scripts`, `assets`, `hooks`, `settings`. Every path must be relative, no `..`.
- **Slots** render Nunjucks templates into the layout. Useful ones here:
  - `index.beforeContent` / `index.afterContent` – home page (the note tagged `gardenEntry`, uses `layouts/index.njk`)
  - `notes.beforeContent` / `notes.afterContent` – every other note
  - `common.head` / `common.footer` – every page
  Every slot template renders on every page of that kind, so each one must gate itself.
- Slot templates get the full data cascade, **including `collections.note`** (checked), plus `pluginSettings`.
- Only files declared as slots/regions are synced into `_includes`. You cannot `{% include %}` an undeclared partial. Use macros in the same file, or HTML-producing filters/shortcodes registered in the hook.
- `{% set %}` inside an included template leaks into the including scope. Prefix every variable (`ch_`).
- Never read another note's `templateContent` from a slot (circular dependency across the build). Work from frontmatter only.
- **Build hooks** (`hooks: "index.js"`) export `setupEleventy(eleventyConfig, context)`. They can only `require` Node built-ins or packages the template already ships. No new npm dependencies. If a hook throws, the loader skips it, and then any template using its filters fails the whole site build. Keep hook code defensive and wrap per-note logic in try/catch.
- Styles in `styles` are linked on every page. Scope everything under `.campaign-hub` or a root class.

## Frontmatter: how published notes reach the templates

The Obsidian publisher does **not** pass arbitrary frontmatter through at the top level. User properties arrive nested:

```js
item.data["dg-note-properties"]   // in collections
noteProps                           // on the current page
```

Always read `(noteProps and noteProps.x) or x` in templates (the fallback covers local test fixtures), and `data["dg-note-properties"]` in hooks. Plugin `noteSettings` / `dg-*` flags are not passed for third-party plugins, so don't use them.

Wikilinks in properties (e.g. `patron: "[[Hedda Stane]]"`) are processed by `resolveLinkProperties` in `obsidian-digital-garden/src/compiler/FrontmatterCompiler.ts`. Check what shape that produces and handle both plain strings and resolved links. Unpublished targets must render as plain text, not dead links.

Notes marked `hide` should be skipped. Use `item.url` for links.

## Data model

Jake writes these as normal Obsidian notes. Keep property names short, lowercase and flat. Obsidian's property editor handles nested objects badly.

**Job** – shows on the rumour board and the job board page
```yaml
type: job
status: open        # open | taken | done | failed
patron: Hedda Stane
reward: 50 gp       # free text
hex: 59             # number or list
taken-by: Thu party # optional
posted: 2026-09-10  # optional, for sorting
summary: Hedda wants to know where the raiders are camped.
```

**Session** (expedition report) – expedition log, roster counts, map reveals
```yaml
type: session
date: 2026-09-10
party: [Ysolde, Brak, Tam]
hexes: [79, 89, 101]
summary: Drove off a goblin scouting party, found the south bridge cut.
```

**Character**
```yaml
type: character
player: Sam
class: Ranger
level: 3
origin: Holtwyn     # optional
status: alive       # alive | dead | retired | missing
fate: fell at the cave mouth  # optional, shown when not alive
```
Expedition count is computed from session notes whose `party` includes the character's name. Don't store it.

**Facility** (Fellgard rebuild tracker)
```yaml
type: facility
progress: 60        # 0-100
state: timber in, needs slate and a smith
warn: false         # true = red bar (e.g. granary running low)
```

**Home note** (the `gardenEntry` note) – hub settings
```yaml
hub: home
world-date: Week 3 after the seal broke · Early summer
next-session: 2026-09-17 19:00
seats: 6
signed-up: 4
headlines:
  - "**The ward broke.** The cave at the foot of Wardpeak stands open."
rumours:
  - The seal was never real.
```

**Hub pages** – an ordinary note with one of:
```yaml
hub: jobs     # full job board, grouped by status
hub: log      # all expeditions, newest first
hub: roster   # all characters, grouped by status
hub: fort     # all facilities
```
The plugin renders the block into `notes.afterContent`, so Jake can write an intro above it.

## What to build (matches the mockup)

Home dashboard (`index.beforeContent`, only when the home note has `hub: home`):
1. Banner: note title, `world-date`, next-session card (hide it client-side once the date has passed, because Forestry only rebuilds on publish)
2. "The valley right now": `headlines` (inline markdown bold/italic only)
3. Map card: if `/hexcrawl-map.json` exists, fetch it client-side and show the explored count and a link to the map note, plus the map image and latest explored hex when the JSON provides them (the `explored`, `latest` and `image` fields are being added to hexcrawl-map, so older versions won't have them). Hide the card if the fetch fails.
4. Rumour board: open and taken jobs as pinned notices, newest first, capped (setting), link to the job board page
5. Expedition log: latest N sessions with party, hex chips linking to `<map>?hex=N`, summary
6. Overheard: `rumours`, show 3 at random client-side (setting: all / random 3)
7. Rebuilding Fellgard: facilities as progress bars
8. Adventurers: characters, alive first, dead struck through
Any section with no data is omitted. Nothing renders an empty box.

Optional site theme (setting, default off): parchment/dark palette, Cinzel + EB Garamond from Google Fonts with system serif fallbacks. Toggled by a class on `<html>` set from a `common.head` slot so it can be switched off cleanly.

**The site's theme is ITS Theme, not this setting.** The garden loads it with `THEME=https://raw.githubusercontent.com/slrvb/Obsidian--ITS-Theme/main/theme.css`, `BASE_THEME=light`, `STYLE_SETTINGS_BODY_CLASSES=wotc-beyond`. The hub must look right inside it. Things a host theme does that broke the hub before, and that any change here must keep working:

- a decorative `::before`/`::after` on a heading becomes a **flex item** in our card headings and wraps the title — switched off on our own headings only
- a themed `li::before` bullet becomes an extra **grid item** in `.ch-pc` roster rows and wraps them
- `--background-primary-alt` is a dark maroon in `wotc-beyond`; never borrow it for surfaces (progress tracks, sigils) — derive from `--ch-panel` instead
- table row/column striping is neutralised through `--table-*-alt-background` inside `.ch-log`, not by out-specifying the theme
- a bare garden with no theme leaves `--text-muted` / `--text-faint` **undefined**; the fallbacks are derived from `--ch-ink` with `color-mix`, never fixed greys

Check any styling change against ITS light, a bare garden, and the plugin's own theme. `dev/setup.sh --its` builds the ITS case.

## Local test harness

Everything in `dev/` is for testing only. Keep it small. It gets copied into the garden on install, which is harmless but counts toward the 10 MB limit.

- `dev/setup.sh`: clone `oleeskild/digitalgarden` into `.garden/` (gitignored), `npm install`, **copy** the repo into `.garden/src/plugins/campaign-hub` (`dev/sync.sh`), copy `dev/fixtures/notes/**` into `.garden/src/site/notes/`. Not a symlink: the loader lists `src/plugins` with `withFileTypes` and keeps only entries whose `isDirectory()` is true, which is false for a symlink, so a symlinked plugin is never discovered.
- `dev/fixtures/notes/`: sample notes in the **published** shape. Frontmatter is JSON with `dg-publish: true`, a `permalink`, and user properties under `dg-note-properties`. Include a home note (`tags: ["gardenEntry"]`), several jobs in each status, sessions, living and dead characters, facilities, and one note of each hub page type. Add a couple of edge cases: missing fields, a hex list as a string, a hidden note.
- `dev/build.sh`: `npm run build` in `.garden`. **Fail if the output contains `[plugins]` warnings or errors.**
- `dev/shot.mjs`: serve `.garden/dist`, use Playwright with Chromium (cloud sessions usually have it preinstalled; check before downloading browsers) to screenshot the home page and each hub page at 1280 px and 400 px. Also check that disabling the plugin (`src/plugins/plugins.json` → `{"plugins":{"campaign-hub":{"enabled":false}}}`) leaves a clean build.
- Look at the screenshots before calling something done. Compare against `docs/hub-mockup.html`.
- Fixtures use made-up characters and jobs only. Player-facing names from the setting (Fellgard, Hedda Stane, Brenna Crowfoot, Oslac, Bram, Orlyn, Wardpeak) are fine.

## Rules

- **No DM secrets, ever.** This repo is public. Only use what's on the published site or what Jake gives you in the chat. If a note or prompt contains DM-only material, leave it out of fixtures, docs and commits.
- The site must never break because of this plugin. Missing or odd frontmatter degrades to "section hidden", not a build error.
- British spelling in anything user-facing. Plain wording, no marketing tone.
- Accessible: real links and buttons, sensible headings, readable contrast, works at 400 px.
- No external requests except Google Fonts (theme) and `/hexcrawl-map.json`.

## Git workflow

- Work on a branch per change (`feat/job-board`, `fix/roster-sorting`), open a PR, merge to `main` once the build and screenshots are good.
- Bump `version` in `garden-plugin.json` on every merge to `main` (patch for fixes, minor for features). Obsidian offers the update when the version changes.
- Don't create GitHub releases (see above).
- Keep `README.md` current: what it does, the frontmatter above, settings, a screenshot.
- After merging, tell Jake: the version number, what changed, and any new frontmatter he needs to add.
