/**
 * Campaign Hub data layer.
 *
 * Pure JavaScript, no dependencies: garden plugins may not add npm packages,
 * and this file is required both by the Eleventy hook (index.js) and by the
 * tests in dev/tests.
 *
 * Everything here is defensive. A note with missing, misspelled or
 * wrong-shaped properties must degrade to "left out", never to a build error:
 * the site has to keep building whatever Jake types into Obsidian's property
 * editor.
 *
 * Reading properties
 * ------------------
 * The Obsidian Digital Garden publisher does not pass user frontmatter
 * through at the top level. It nests every user property under
 * "dg-note-properties" (FrontmatterCompiler.extractUserProperties), so in a
 * collection they are at item.data["dg-note-properties"]. We fall back to the
 * top level as well, which covers notes published with dgPassFrontmatter on
 * and hand-written local fixtures.
 *
 * Link-shaped values (patron: "[[Hedda Stane]]") are rewritten by the
 * publisher's resolveLinkProperties to the target's full vault path
 * ("[[People/Hedda Stane]]"), or left alone when the target does not resolve.
 * They arrive as plain strings either way, so we parse the wikilink here and
 * look the target up among the published notes. Anything unpublished renders
 * as plain text rather than a dead link.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const JOB_STATUSES = ["open", "taken", "done", "failed"];
const CHARACTER_STATUSES = ["alive", "missing", "retired", "dead"];
const HUB_PAGES = ["home", "jobs", "log", "roster", "fort"];

/** User properties, nested by the publisher, with a top-level fallback. */
function propsOf(data) {
  if (!data || typeof data !== "object") return {};
  const nested = data["dg-note-properties"];
  const base = nested && typeof nested === "object" ? nested : {};
  return { ...data, ...base };
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : value.toISOString();
  return "";
}

function lower(value) {
  return text(value).toLowerCase();
}

/**
 * Coerce a property to a list. Obsidian writes lists as YAML arrays, but a
 * hand-typed "79, 89, 101" is common enough to be worth handling; so is a
 * multi-line string.
 */
function list(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => (Array.isArray(item) ? list(item) : [item]))
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter((item) => item !== "" && item !== null && item !== undefined);
  }
  if (typeof value === "number") return [value];
  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((part) => part.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);
  }
  return [];
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = text(value).match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolean(value) {
  if (typeof value === "boolean") return value;
  const asText = lower(value);
  return asText === "true" || asText === "yes";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** "[[People/Hedda Stane|Hedda]]" -> { target, label }. */
function parseWikilink(value) {
  const raw = text(value);
  const match = raw.match(/^!?\[\[([^\]]+)\]\]$/);
  if (!match) return null;
  const inner = match[1];
  const pipe = inner.indexOf("|");
  const label = pipe === -1 ? "" : inner.slice(pipe + 1).trim();
  const target = (pipe === -1 ? inner : inner.slice(0, pipe)).split("#")[0].trim();
  if (!target) return null;
  return { target, label: label || target.split("/").pop() };
}

/**
 * Dates arrive as ISO-ish strings (published frontmatter is JSON) or as Date
 * objects (YAML parsed locally). Everything is read and formatted in UTC so a
 * build machine's timezone can never shift a session by a day.
 */
function parseDate(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/
  );
  if (!match) {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    match[4] === undefined ? 0 : Number(match[4]),
    match[5] === undefined ? 0 : Number(match[5])
  ));
  return isNaN(date.getTime()) ? null : date;
}

function hasTime(value) {
  if (value instanceof Date) return true;
  return /[T ]\d{1,2}:\d{2}/.test(text(value));
}

function formatShortDate(date) {
  if (!date) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
}

function formatLongDate(date) {
  if (!date) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatMonth(date) {
  if (!date) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatClock(date) {
  if (!date) return "";
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const suffix = hours < 12 ? "am" : "pm";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${display}${suffix}`
    : `${display}.${String(minutes).padStart(2, "0")}${suffix}`;
}

/** "Thu 17 Sep · 7pm" — the next-session card in the mockup. */
function formatSessionTime(date, withTime) {
  if (!date) return "";
  const day = `${DAYS[date.getUTCDay()]} ${formatShortDate(date)}`;
  return withTime ? `${day} · ${formatClock(date)}` : day;
}

function sortKey(value) {
  const asText = lower(value);
  return asText;
}

/** Order by a scored bucket first (statuses), then a text key. */
function byRank(ranks, key) {
  return (a, b) => {
    const rankA = ranks.indexOf(a.status) === -1 ? ranks.length : ranks.indexOf(a.status);
    const rankB = ranks.indexOf(b.status) === -1 ? ranks.length : ranks.indexOf(b.status);
    if (rankA !== rankB) return rankA - rankB;
    return sortKey(a[key]) < sortKey(b[key]) ? -1 : sortKey(a[key]) > sortKey(b[key]) ? 1 : 0;
  };
}

/** Newest first; undated entries sink to the bottom in title order. */
function byDateDesc(a, b) {
  const timeA = a.date ? a.date.getTime() : null;
  const timeB = b.date ? b.date.getTime() : null;
  if (timeA === null && timeB === null) {
    return sortKey(a.title) < sortKey(b.title) ? -1 : 1;
  }
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeB - timeA;
}

/**
 * Index of published notes, so wikilink properties can become real links.
 * Keyed on the vault path the publisher writes ("People/Hedda Stane"), the
 * note title and the file slug, all lowercased.
 */
function buildNoteIndex(notes) {
  const index = new Map();
  const add = (key, entry) => {
    const normalised = lower(key);
    if (normalised && !index.has(normalised)) index.set(normalised, entry);
  };
  for (const note of notes) {
    const entry = { title: note.title, url: note.url };
    add(note.path, entry);
    add(note.path.split("/").pop(), entry);
    add(note.title, entry);
    add(note.slug, entry);
  }
  return index;
}

/**
 * Turn one property value into a link reference. Plain strings stay plain
 * unless they happen to name a published note; unresolved wikilinks keep
 * their label and lose the brackets, so nothing renders as a dead link.
 */
function toRef(value, index) {
  const link = parseWikilink(value);
  const label = link ? link.label : text(value);
  if (!label) return null;
  const lookup = index.get(lower(link ? link.target : label));
  return { text: label, url: lookup ? lookup.url : "" };
}

function toRefs(value, index) {
  return list(value).map((item) => toRef(item, index)).filter(Boolean);
}

/** Hex numbers, from a list, a single number or "79, 89, 101". */
function toHexes(value) {
  const seen = new Set();
  const hexes = [];
  for (const item of list(value)) {
    const parsed = number(item);
    if (parsed === null) continue;
    const hex = Math.trunc(parsed);
    if (seen.has(hex)) continue;
    seen.add(hex);
    hexes.push(hex);
  }
  return hexes;
}

/**
 * Reduce collections.note down to what the templates need. Each note is
 * processed in its own try/catch: one bad note is dropped, the rest of the
 * hub still renders.
 */
function readNotes(collection) {
  const notes = [];
  for (const item of Array.isArray(collection) ? collection : []) {
    try {
      const data = item && item.data ? item.data : {};
      const props = propsOf(data);
      if (data.hide === true || props.hide === true) continue;
      const stem = text(item.filePathStem).replace(/^\/?notes\//, "");
      notes.push({
        url: text(item.url),
        slug: text(item.fileSlug),
        path: stem,
        title: text(props.title) || text(data.title) || text(item.fileSlug) || stem,
        type: lower(props.type),
        hub: lower(props.hub),
        props,
      });
    } catch {
      // A note we cannot read is a note we leave out.
    }
  }
  return notes;
}

function readJob(note, index) {
  const props = note.props;
  const status = lower(props.status);
  const posted = parseDate(props.posted);
  return {
    url: note.url,
    title: note.title,
    status: JOB_STATUSES.includes(status) ? status : "open",
    patron: toRef(props.patron, index),
    reward: text(props.reward),
    hexes: toHexes(props.hex),
    takenBy: text(props["taken-by"]) || text(props.takenBy),
    posted,
    postedText: formatLongDate(posted),
    summary: text(props.summary),
  };
}

function readSession(note, index) {
  const date = parseDate(note.props.date);
  return {
    url: note.url,
    title: note.title,
    date,
    dateShort: formatShortDate(date),
    dateLong: formatLongDate(date),
    month: formatMonth(date),
    party: toRefs(note.props.party, index),
    hexes: toHexes(note.props.hexes),
    summary: text(note.props.summary),
  };
}

function readCharacter(note, index) {
  const p = note.props;
  const status = lower(p.status);
  const level = number(p.level);
  return {
    url: note.url,
    title: note.title,
    player: text(p.player),
    className: text(p.class),
    level: level === null ? null : Math.trunc(level),
    origin: toRef(p.origin, index),
    status: CHARACTER_STATUSES.includes(status) ? status : "alive",
    fate: text(p.fate),
    initial: (note.title.trim()[0] || "?").toUpperCase(),
    expeditions: 0,
    sessions: [],
  };
}

function readFacility(note) {
  const p = note.props;
  const progress = number(p.progress);
  return {
    url: note.url,
    title: note.title,
    progress: progress === null ? 0 : clamp(Math.round(progress), 0, 100),
    hasProgress: progress !== null,
    state: text(p.state),
    warn: boolean(p.warn),
  };
}

/**
 * Expedition counts come from the sessions, never from a property: a party
 * list is the record of who was there, and a stored count goes stale.
 * Matching is on the character's title or slug, case-insensitively, so
 * "party: [Ysolde]" and "party: ['[[People/Ysolde|Ysolde]]']" both count.
 */
function linkCharactersToSessions(characters, sessions) {
  const byName = new Map();
  for (const character of characters) {
    for (const key of [character.title, character.url]) {
      const normalised = lower(key);
      if (normalised) byName.set(normalised, character);
    }
  }
  for (const session of sessions) {
    const counted = new Set();
    for (const member of session.party) {
      const character =
        byName.get(lower(member.text)) ||
        (member.url ? byName.get(lower(member.url)) : undefined);
      if (!character || counted.has(character)) continue;
      counted.add(character);
      character.sessions.push({
        title: session.title,
        url: session.url,
        date: session.date,
        dateShort: session.dateShort,
        dateLong: session.dateLong,
      });
    }
  }
  for (const character of characters) {
    character.sessions.sort(byDateDesc);
    character.expeditions = character.sessions.length;
    character.lastSeen = character.sessions.length ? character.sessions[0] : null;
  }
}

function groupBy(items, keys, keyOf) {
  return keys
    .map((key) => ({ key, items: items.filter((item) => keyOf(item) === key) }))
    .filter((group) => group.items.length > 0);
}

/** Sessions grouped into months, newest month first, for the log page. */
function groupSessionsByMonth(sessions) {
  const groups = [];
  for (const session of sessions) {
    const key = session.month || "Undated";
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.items.push(session);
    else groups.push({ key, items: [session] });
  }
  return groups;
}

/**
 * The whole model, from collections.note. Called once per page that needs it
 * (Eleventy caches nothing for us, but the collection is small and this is
 * plain array work).
 */
function buildModel(collection) {
  const notes = readNotes(collection);
  const index = buildNoteIndex(notes);

  const jobs = [];
  const sessions = [];
  const characters = [];
  const facilities = [];
  const hubPages = {};
  let mapNote = null;

  for (const note of notes) {
    try {
      if (note.type === "job") jobs.push(readJob(note, index));
      else if (note.type === "session") sessions.push(readSession(note, index));
      else if (note.type === "character") characters.push(readCharacter(note, index));
      else if (note.type === "facility") facilities.push(readFacility(note));

      if (HUB_PAGES.includes(note.hub) && !hubPages[note.hub]) {
        hubPages[note.hub] = { title: note.title, url: note.url };
      }
      if (!mapNote && boolean(note.props.hexmap)) {
        mapNote = { title: note.title, url: note.url };
      }
    } catch {
      // Skip the note, keep the hub.
    }
  }

  sessions.sort(byDateDesc);
  linkCharactersToSessions(characters, sessions);

  jobs.sort((a, b) => {
    const timeA = a.posted ? a.posted.getTime() : -Infinity;
    const timeB = b.posted ? b.posted.getTime() : -Infinity;
    if (timeA !== timeB) return timeB - timeA;
    return sortKey(a.title) < sortKey(b.title) ? -1 : 1;
  });
  characters.sort(byRank(CHARACTER_STATUSES, "title"));
  facilities.sort((a, b) => (sortKey(a.title) < sortKey(b.title) ? -1 : 1));

  return {
    jobs,
    sessions,
    characters,
    facilities,
    hubPages,
    mapNote,
    jobsByStatus: groupBy(jobs, JOB_STATUSES, (job) => job.status),
    charactersByStatus: groupBy(characters, CHARACTER_STATUSES, (c) => c.status),
    sessionsByMonth: groupSessionsByMonth(sessions),
    // Open and taken jobs, newest first: the notices still worth reading.
    board: jobs.filter((job) => job.status === "open" || job.status === "taken"),
  };
}

/**
 * Home-note settings. These come from the page's own properties rather than
 * the collection, because the home dashboard only ever renders on that note.
 */
function buildHome(pageProps) {
  const p = propsOf(pageProps);
  const next = parseDate(p["next-session"] || p.nextSession);
  const seats = number(p.seats);
  const signedUp = number(p["signed-up"] === undefined ? p.signedUp : p["signed-up"]);
  return {
    isHub: lower(p.hub) === "home",
    worldDate: text(p["world-date"] || p.worldDate),
    next: next
      ? {
          iso: next.toISOString(),
          display: formatSessionTime(next, hasTime(p["next-session"] || p.nextSession)),
        }
      : null,
    seats: seats === null ? null : Math.trunc(seats),
    signedUp: signedUp === null ? null : Math.trunc(signedUp),
    headlines: list(p.headlines).map(text).filter(Boolean),
    rumours: list(p.rumours).map(text).filter(Boolean),
  };
}

module.exports = {
  buildModel,
  buildHome,
  propsOf,
  parseWikilink,
  parseDate,
  formatShortDate,
  formatLongDate,
  formatSessionTime,
  toHexes,
  list,
  number,
  text,
  JOB_STATUSES,
  CHARACTER_STATUSES,
};
