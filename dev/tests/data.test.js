/**
 * Data layer tests. Run with `node --test dev/tests/` — node's own runner, so
 * the plugin still ships no npm dependencies.
 *
 * The fixtures under dev/fixtures/notes are read the way Eleventy would build
 * collections.note from them, so these tests cover the real published
 * frontmatter shape, including the edge cases.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const data = require("../../lib/data");

const NOTES = path.join(__dirname, "..", "fixtures", "notes");

/** Rebuild collections.note from the fixture files. */
function loadCollection() {
  const items = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const raw = fs.readFileSync(full, "utf8");
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      const front = match ? JSON.parse(match[1]) : {};
      const stem = full.slice(NOTES.length).replace(/\.md$/, "");
      const isHome = Array.isArray(front.tags) && front.tags.includes("gardenEntry");
      items.push({
        url: isHome ? "/" : front.permalink,
        fileSlug: path.basename(stem),
        filePathStem: `/notes${stem}`,
        data: front,
      });
    }
  };
  walk(NOTES);
  return items;
}

const collection = loadCollection();
const model = data.buildModel(collection);

test("reads every fixture type", () => {
  assert.equal(model.jobs.length, 7);
  assert.equal(model.sessions.length, 4);
  assert.equal(model.characters.length, 6);
  assert.equal(model.facilities.length, 5);
});

test("hidden notes never reach the hub", () => {
  assert.ok(!model.jobs.some((job) => /private worry/i.test(job.title)));
});

test("finds the hub pages and the map note", () => {
  assert.equal(model.hubPages.jobs.url, "/job-board/");
  assert.equal(model.hubPages.log.url, "/expedition-log/");
  assert.equal(model.hubPages.roster.url, "/adventurers/");
  assert.equal(model.hubPages.fort.url, "/rebuilding-fellgard/");
  assert.equal(model.mapNote.url, "/map-of-dunvale/");
});

test("resolves a wikilink property to the published note", () => {
  const job = model.jobs.find((j) => j.title.startsWith("Burnt farmsteads"));
  assert.deepEqual(job.patron, { text: "Hedda Stane", url: "/people/hedda-stane/" });
});

test("keeps a wikilink alias", () => {
  const job = model.jobs.find((j) => j.title.startsWith("Escort the tithe"));
  assert.equal(job.patron.text, "Brenna");
  assert.equal(job.patron.url, "/people/brenna-crowfoot/");
});

test("an unpublished wikilink target becomes plain text, not a dead link", () => {
  const job = model.jobs.find((j) => j.title.startsWith("Rites at"));
  assert.equal(job.patron.text, "Oslac");
  assert.equal(job.patron.url, "");
});

test("a plain string patron stays plain", () => {
  const job = model.jobs.find((j) => j.title.startsWith("The drowned mill"));
  assert.equal(job.patron.text, "Bram");
  assert.equal(job.patron.url, "");
});

test("hexes typed as a string are read as numbers", () => {
  const job = model.jobs.find((j) => j.title.startsWith("The drowned mill"));
  assert.deepEqual(job.hexes, [88, 89]);
  const session = model.sessions.find((s) => s.title.startsWith("Up the canyon"));
  assert.deepEqual(session.hexes, [57, 48]);
});

test("a job with almost no properties still reads", () => {
  const job = model.jobs.find((j) => j.title.startsWith("Salt for"));
  assert.equal(job.status, "open");
  assert.equal(job.patron, null);
  assert.deepEqual(job.hexes, []);
  assert.equal(job.summary, "");
});

test("jobs sort newest first, undated last", () => {
  const titles = model.jobs.map((job) => job.title);
  assert.ok(titles.indexOf("Escort the tithe wagon") < titles.indexOf("The drowned mill"));
  assert.equal(titles[titles.length - 1], "Salt for the winter");
});

test("the rumour board is open and taken jobs only", () => {
  assert.ok(model.board.length > 0);
  assert.ok(model.board.every((job) => job.status === "open" || job.status === "taken"));
});

test("jobs group by status in board order", () => {
  assert.deepEqual(model.jobsByStatus.map((group) => group.key), [
    "open", "taken", "done", "failed",
  ]);
});

test("sessions sort newest first and an undated one sinks", () => {
  assert.equal(model.sessions[0].title, "The bridges below the Wyrm");
  assert.equal(model.sessions[model.sessions.length - 1].title, "The long walk back");
  assert.equal(model.sessions[0].dateShort, "10 Sep");
  assert.equal(model.sessions[0].month, "September 2026");
});

test("expedition counts come from the session parties", () => {
  const find = (name) => model.characters.find((c) => c.title === name);
  assert.equal(find("Ysolde").expeditions, 3);
  assert.equal(find("Brak").expeditions, 3);
  assert.equal(find("Oren").expeditions, 2);
  assert.equal(find("Fen").expeditions, 1);
});

test("a party member given as a wikilink counts too", () => {
  const oren = model.characters.find((c) => c.title === "Oren");
  assert.ok(oren.sessions.some((s) => s.title === "Up the canyon path"));
});

test("characters sort alive, missing, retired, dead", () => {
  assert.deepEqual(model.characters.map((c) => c.status), [
    "alive", "alive", "alive", "missing", "retired", "dead",
  ]);
});

test("a character with no class still reads", () => {
  const fen = model.characters.find((c) => c.title === "Fen");
  assert.equal(fen.className, "");
  assert.equal(fen.level, null);
  assert.equal(fen.status, "missing");
});

test("facility progress is clamped, and words fall back to zero", () => {
  const granary = model.facilities.find((f) => f.title === "Granary");
  assert.equal(granary.progress, 30);
  assert.equal(granary.warn, true);
  const palisade = model.facilities.find((f) => f.title === "Palisade");
  assert.equal(palisade.progress, 0);
  assert.equal(palisade.hasProgress, false);
});

test("home settings read from the home note", () => {
  const homeNote = collection.find((item) => item.url === "/");
  const home = data.buildHome(homeNote.data["dg-note-properties"]);
  assert.equal(home.isHub, true);
  assert.equal(home.seats, 6);
  assert.equal(home.signedUp, 4);
  assert.equal(home.headlines.length, 4);
  assert.equal(home.rumours.length, 5);
  assert.equal(home.next.display, "Thu 17 Sep · 7pm");
  assert.ok(home.worldDate.startsWith("Week 3"));
});

test("a note that is not the hub reports isHub false", () => {
  assert.equal(data.buildHome({ hub: "jobs" }).isHub, false);
  assert.equal(data.buildHome({}).isHub, false);
  assert.equal(data.buildHome(null).isHub, false);
});

test("rubbish input never throws", () => {
  for (const input of [null, undefined, "nope", 7, {}, [null], [{ data: null }]]) {
    assert.doesNotThrow(() => data.buildModel(input));
  }
  assert.equal(data.buildModel(null).jobs.length, 0);
  assert.equal(data.buildModel([{ data: { "dg-note-properties": null } }]).jobs.length, 0);
});

test("a note whose properties are the wrong shape is skipped, not fatal", () => {
  const model = data.buildModel([
    { url: "/a/", fileSlug: "a", filePathStem: "/notes/a",
      data: { "dg-note-properties": { type: "job", hex: { nope: true }, party: 42 } } },
    { url: "/b/", fileSlug: "b", filePathStem: "/notes/b",
      data: { "dg-note-properties": { type: "session", date: "not a date", hexes: true } } },
  ]);
  assert.equal(model.jobs.length, 1);
  assert.deepEqual(model.jobs[0].hexes, []);
  assert.equal(model.sessions.length, 1);
  assert.equal(model.sessions[0].date, null);
});

test("dates are read in UTC, whatever the build machine's timezone", () => {
  assert.equal(data.formatShortDate(data.parseDate("2026-01-01")), "1 Jan");
  assert.equal(data.formatLongDate(data.parseDate("2026-12-31T23:30")), "31 December 2026");
  assert.equal(data.formatSessionTime(data.parseDate("2026-09-17 19:30"), true), "Thu 17 Sep · 7.30pm");
});
