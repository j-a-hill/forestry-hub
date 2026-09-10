#!/usr/bin/env node
/**
 * Serve .garden/dist and screenshot the hub pages at desktop and phone width.
 *
 * Cloud sessions and most dev machines already have a Chromium that Playwright
 * can drive (PLAYWRIGHT_BROWSERS_PATH), so this never downloads a browser: if
 * Playwright is not there, it says so and stops.
 *
 *   node dev/shot.mjs                screenshot every page below
 *   node dev/shot.mjs --tag theme    write them as <page>-theme-<width>.png
 */
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(REPO_ROOT, ".garden", "dist");
const SHOTS = join(REPO_ROOT, "dev", "screenshots");

const PAGES = [
  ["home", "/"],
  ["jobs", "/job-board/"],
  ["log", "/expedition-log/"],
  ["roster", "/adventurers/"],
  ["fort", "/rebuilding-fellgard/"],
  ["note-job", "/jobs/burnt-farmsteads-north-of-carlinholt/"],
  ["note-session", "/expeditions/the-bridges-below-the-wyrm/"],
  ["note-character", "/adventurers/ysolde/"],
  ["note-plain", "/lore/current-situation/"],
];

const WIDTHS = [1280, 400];

/* CHROME_PATH overrides; otherwise fall back to the Chromium the sandbox
   image installs, if it is there. */
const CHROME_PATH = process.env.CHROME_PATH
  || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : "");

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

async function readAny(...candidates) {
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return [await readFile(candidate), candidate];
    } catch {
      // Try the next shape.
    }
  }
  return [null, null];
}

function serve() {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const base = join(DIST, path);
    const [body, found] = await readAny(base, join(base, "index.html"), `${base}.html`);
    if (!body) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "content-type": MIME[extname(found)] || "application/octet-stream" });
    response.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const tagIndex = process.argv.indexOf("--tag");
  const tag = tagIndex === -1 ? "" : `-${process.argv[tagIndex + 1]}`;

  /* Playwright lives in .garden/node_modules — this repo has no package.json
     of its own, and adding one would ship node_modules to every install. */
  let chromium;
  for (const specifier of [
    "playwright",
    pathToFileURL(join(REPO_ROOT, ".garden", "node_modules", "playwright", "index.js")).href,
  ]) {
    try {
      const playwright = await import(specifier);
      chromium = playwright.chromium || (playwright.default && playwright.default.chromium);
      if (chromium) break;
    } catch {
      // Try the next place it might be.
    }
  }
  if (!chromium) {
    console.error(
      "playwright is not installed. Run `npm install -D playwright` in .garden/."
    );
    process.exit(1);
  }

  await mkdir(SHOTS, { recursive: true });
  const { server, port } = await serve();
  /* Use whatever Chromium is already on the machine when Playwright's own
     download is missing — cloud sessions ship one, and this repo has no
     package.json to pin a matching version against. */
  const browser = await chromium.launch(
    CHROME_PATH ? { executablePath: CHROME_PATH } : {}
  );
  const problems = [];

  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
      });
      /* Screenshot the site as built, not the internet: block every request
         that does not come from our own server. The template pulls a search
         index and an icon set from CDNs, and the campaign theme pulls two
         typefaces from Google Fonts — none of which should decide whether a
         screenshot run passes, or how long it takes. */
      await context.route("**/*", (route) => {
        const url = route.request().url();
        return url.startsWith("http://127.0.0.1:") ? route.continue() : route.abort();
      });

      const page = await context.newPage();
      /* The template's own CDN scripts are blocked above, so their absence is
         expected; only errors from the plugin are worth reporting. */
      page.on("pageerror", (error) => {
        const message = String(error && error.message);
        if (/FlexSearch|lucide/.test(message)) return;
        problems.push(message);
      });

      for (const [name, path] of PAGES) {
        const response = await page.goto(`http://127.0.0.1:${port}${path}`, {
          waitUntil: "load",
        });
        if (!response || !response.ok()) {
          problems.push(`${path} returned ${response ? response.status() : "nothing"}`);
          continue;
        }
        const file = join(SHOTS, `${name}${tag}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`wrote ${file.replace(`${REPO_ROOT}/`, "")}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (problems.length) {
    console.error("\nProblems while screenshotting:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
}

main();
