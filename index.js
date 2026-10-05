/**
 * Campaign Hub build hook.
 *
 * Registers the filters the slot templates use. Nothing here may throw at
 * config time: the loader would skip the hook, and the templates would then
 * fail on an unknown filter and take the whole site build with them. Every
 * filter therefore catches its own errors and returns an empty result.
 */

const data = require("./lib/data");

/** Escape before any of our own markup goes in. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The small subset of inline markdown worth supporting in properties:
 * **bold**, *italic*, _italic_ and `code`. Deliberately not a markdown
 * parser — headlines and rumours are single lines typed in Obsidian's
 * property editor, and everything is escaped first so no property can inject
 * markup into the page.
 */
function inlineMarkdown(value) {
  const escaped = escapeHtml(data.text(value));
  if (!escaped) return "";
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
}

/** Deep link into the hex map note, or nothing when there is no map. */
function hexUrl(mapNote, hex) {
  if (!mapNote || !mapNote.url) return "";
  return `${mapNote.url}?hex=${encodeURIComponent(hex)}`;
}

const EMPTY_MODEL = {
  jobs: [],
  sessions: [],
  characters: [],
  facilities: [],
  hubPages: {},
  mapNote: null,
  jobsByStatus: [],
  charactersByStatus: [],
  sessionsByMonth: [],
  board: [],
};

function safe(fn, fallback) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      console.warn(`[campaign-hub] ${error && error.message}`);
      return typeof fallback === "function" ? fallback() : fallback;
    }
  };
}

/**
 * The hexes hexcrawl-map has revealed, read from the filter it builds
 * /hexcrawl-map.json with, so the roster agrees with the map without
 * duplicating its rules. Looked up when a page renders rather than at setup,
 * because plugins load in any order. No hexcrawl-map, or anything going
 * wrong, means nothing is revealed: a character's hex then reads "Out in the
 * wilds" and the number never reaches the page.
 */
function mapRevealer(eleventyConfig) {
  const cache = new WeakMap();
  return (collection) => {
    try {
      if (collection && typeof collection === "object" && cache.has(collection)) {
        return cache.get(collection);
      }
      const indexFilter =
        typeof eleventyConfig.getFilter === "function"
          ? eleventyConfig.getFilter("hexcrawlIndex")
          : null;
      const revealed =
        typeof indexFilter === "function"
          ? data.revealedHexes(indexFilter(collection))
          : new Set();
      if (collection && typeof collection === "object") cache.set(collection, revealed);
      return revealed;
    } catch (error) {
      console.warn(`[campaign-hub] could not read the map's explored hexes: ${error && error.message}`);
      return new Set();
    }
  };
}

module.exports = {
  setupEleventy(eleventyConfig) {
    const revealedFor = mapRevealer(eleventyConfig);

    eleventyConfig.addFilter(
      "campaignHub",
      safe(
        (collection) => data.buildModel(collection, { revealed: revealedFor(collection) }),
        () => ({ ...EMPTY_MODEL })
      )
    );

    eleventyConfig.addFilter(
      "campaignHubHome",
      safe((pageProps) => data.buildHome(pageProps), () => data.buildHome({}))
    );

    eleventyConfig.addFilter("campaignHubInline", safe(inlineMarkdown, ""));

    // Nunjucks' own lower and trim call string methods on whatever they are
    // given, and throw on a list, a number or true. The slot templates run on
    // every note in the vault, so one note with `type: [npc, merchant]` took
    // the whole site build down. Any property read straight off a note goes
    // through this instead: a list or object reads as "", which is no type.
    eleventyConfig.addFilter(
      "campaignHubKey",
      safe((value) => data.text(value).toLowerCase(), "")
    );

    eleventyConfig.addFilter("campaignHubHexUrl", safe(hexUrl, ""));

    // A number the settings UI may hand back as a string.
    eleventyConfig.addFilter(
      "campaignHubLimit",
      safe((items, count, fallbackCount) => {
        if (!Array.isArray(items)) return [];
        const parsed = data.number(count);
        const limit = parsed === null ? fallbackCount : Math.trunc(parsed);
        if (!Number.isFinite(limit) || limit < 0) return items;
        return items.slice(0, limit);
      }, [])
    );
  },
};
