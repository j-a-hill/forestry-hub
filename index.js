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

module.exports = {
  setupEleventy(eleventyConfig) {
    eleventyConfig.addFilter(
      "campaignHub",
      safe((collection) => data.buildModel(collection), () => ({ ...EMPTY_MODEL }))
    );

    eleventyConfig.addFilter(
      "campaignHubHome",
      safe((pageProps) => data.buildHome(pageProps), () => data.buildHome({}))
    );

    eleventyConfig.addFilter("campaignHubInline", safe(inlineMarkdown, ""));

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
