# Campaign Hub

A [Digital Garden](https://github.com/oleeskild/digitalgarden) plugin that
turns a garden into the hub for a West Marches tabletop campaign.

Jobs, expedition reports, characters and rebuild projects are ordinary
Obsidian notes with a couple of properties on them. The plugin reads those
properties and builds a home dashboard and four index pages, so the site
stays current by publishing notes rather than by editing any page by hand.

Built for [dunvale.forestry.md](https://dunvale.forestry.md) and its sibling
plugin [hexcrawl-map](https://github.com/j-a-hill/forestry-hexmap), which the
map card reads when it is installed. Everything works without it.

![The home dashboard](docs/screenshot-home.png)

*Above: the hub under [ITS Theme](https://github.com/slrvb/Obsidian--ITS-Theme)
with its `wotc-beyond` palette — see [Theme](#theme).*

## Installing

Obsidian → Settings → Digital Garden → **Garden Plugins** → **Manage plugins**,
install from URL, and paste `https://github.com/j-a-hill/forestry-hub`. Open the
same screen later to update when the version number changes.

The installer takes the repository's latest release if there is one, otherwise
its default branch — so `main` must be the default branch on GitHub.

Then add `hub: home` to your home note's properties. Without it the dashboard
stays hidden, which is deliberate: the plugin shows nothing until you opt in.

## What it builds

**The home dashboard**, on the note tagged `gardenEntry`, when that note has
`hub: home`:

- a banner with the title, the in-world date and the next session
- *The valley right now* — the headlines you wrote on the home note
- a map card, filled in from the hexcrawl-map plugin's data
- the rumour board — open and taken jobs, newest first
- the expedition log — the most recent sessions, with hexes linked into the map
- *Overheard* — your rumours, three at random on each visit
- the rebuild tracker, and the roster with expedition counts

Any section with nothing to show is left out entirely.

**Four index pages**, each an ordinary note you can write an intro on:
`hub: jobs`, `hub: log`, `hub: roster` and `hub: fort`.

**A property strip** under the title of every job, session and character note.

## The notes

Every property is optional unless it says otherwise. A note with an unexpected
value is left out of the hub rather than breaking the build.

### A job

```yaml
type: job            # required
status: open         # open | taken | done | failed (default open)
patron: "[[Hedda Stane]]"
reward: 50 gp        # free text
hex: 59              # a number, a list, or "59, 60"
taken-by: Thu party
posted: 2026-09-10   # sorts the board, newest first
summary: Hedda wants to know where the raiders are camped.
```

### An expedition report

```yaml
type: session        # required
date: 2026-09-10
party: [Ysolde, Brak, Tam]
hexes: [79, 89, 101]
summary: Drove off a goblin scouting party, found the south bridge cut.
```

### A character

```yaml
type: character      # required
player: Sam
class: Ranger
level: 3
origin: Holtwyn
status: alive        # alive | missing | retired | dead (default alive)
fate: fell at the cave mouth   # shown when the status is not alive
location: Ledge Camp # optional: where they are now, a place name or a hex
```

Expedition counts are worked out from the session notes whose `party`
includes the character, so there is no count to keep up to date.

`location` shows as "Where: …" on the roster, the home page and the
character's own note. Leave it empty to show nothing. A place name
(`Fellgard`, `Ledge Camp`, `missing`) is shown as typed. A hex number
(`location: 57`) shows as "Hex 57", linked to the map, but only once the map
has revealed that hex; until then it reads "Out in the wilds", so the roster
never gives away a hex the players haven't found. Without the hexcrawl-map
plugin every hex reads "Out in the wilds". Setting a location never reveals a
hex on the map.

### A rebuild project

```yaml
type: facility       # required
progress: 60         # 0–100
state: timber in, needs slate and a smith
warn: false          # true turns the bar red
```

### The home note

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

`headlines` and `rumours` take `**bold**`, `*italic*` and `` `code` ``.
Nothing else — they are one-line properties, not markdown documents.

### An index page

```yaml
hub: jobs     # or log, roster, fort
```

A property that holds a link (`patron`, `party`, `origin`) can be a wikilink
or plain text. A wikilink to a note you have not published renders as plain
text, never as a dead link.

## Theme

The hub is drawn in whatever Obsidian theme your garden is using — it reads
the theme's own colour variables rather than imposing its own. The look above
is **ITS Theme** by SlRvb, which most tabletop vaults already use, in its
D&D Beyond palette. It is set from Obsidian, not typed in anywhere: the
Digital Garden plugin writes the values to your site when you click through
these screens.

**1. The theme.** Obsidian → Settings → Digital Garden → **Appearance** →
**Manage appearance**. Under *Theme Settings*, pick **ITS Theme** and set
**Base theme** to *light*, then **Apply settings to site**.

**2. The palette.** This needs the *Style Settings* community plugin, which
is how ITS offers its palettes. Obsidian → Settings → Style Settings →
ITS Theme → *Alternate Color Schemes* → **TTRPG** → **WOTC/Beyond**. Switch
Obsidian itself to light mode, then go back to **Manage appearance** and click
**Apply Style Settings**.

Light mode matters in step 2: *Apply Style Settings* copies every class on
Obsidian's own page, including its light or dark mode. If Obsidian is dark
while the site's base theme is light, the site gets both and they fight.

Other TTRPG palettes in the same dropdown work too — SlRvb D&D, Pathfinder,
Pathfinder Remaster. Each works in light or dark; keep the base theme and
Obsidian's own mode matching.

For reference, these land on the site as `THEME` (the ITS stylesheet),
`BASE_THEME=light` and `STYLE_SETTINGS_BODY_CLASSES` (containing `wotc-beyond`).

Prefer a light palette if your players read on phones. `wotc-beyond` puts
dark brown ink on cream at about 11:1 contrast, which holds up for job
summaries and expedition reports in daylight.

The plugin brings no palette or typefaces of its own, and makes no requests
outside your site except for the hex map's data.

## Settings

Obsidian → Settings → Digital Garden → Plugins → Campaign Hub.

| Setting | Default | What it does |
|---|---|---|
| Jobs on the rumour board | 4 | How many open or taken jobs the home page pins up |
| Expeditions on the home page | 3 | How many recent sessions the home page lists |
| Overheard rumours | random 3 | Three at random on each visit, or all of them |
| Hex map data | `/hexcrawl-map.json` | Where the map card reads its data |
| Property strip on notes | on | The strip under the title of job, session and character notes |

![The home dashboard on a phone](docs/screenshot-home-phone.png)

## Working on it

```
dev/setup.sh          clone the garden template into .garden/ and wire this in
dev/setup.sh --hexmap the same, plus the hexcrawl-map plugin, to test the map card
dev/build.sh          build, and fail on any [plugins] warning
dev/build.sh --off    build with the plugin disabled, to prove the site is unchanged
node dev/shot.mjs     screenshot every page at 1280 px and 400 px
node --test dev/tests/data.test.js
```

`dev/fixtures/notes/` holds a fake campaign in the shape the Obsidian
publisher actually writes — JSON frontmatter with user properties nested under
`dg-note-properties` — including the awkward cases: missing properties, a hex
list typed as a string, a session with no date, an unpublished wikilink target
and a hidden note.

The plugin is copied rather than symlinked into the test garden on purpose:
the loader lists `src/plugins` with `withFileTypes` and keeps only entries
where `isDirectory()` is true, which is false for a symlink, so a symlinked
plugin is never discovered.
