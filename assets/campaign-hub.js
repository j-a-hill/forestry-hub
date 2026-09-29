/*
 * Campaign Hub – client side.
 *
 * Three small jobs, all of them progressive enhancements. Forestry only
 * rebuilds the site when Jake publishes, so anything that depends on "now"
 * has to happen in the browser.
 *
 * Every page on the site loads this file, so it exits immediately when there
 * is no hub on the page.
 */
(function () {
  "use strict";

  /* The next-session card is stale once the session has started; hide it
     rather than telling players about a game that already happened. */
  function hidePastSession() {
    var card = document.querySelector("[data-ch-until]");
    if (!card) return;
    var until = Date.parse(card.getAttribute("data-ch-until"));
    if (isNaN(until)) return;
    /* Keep it up for the evening it names, not just until the start time. */
    if (Date.now() > until + 6 * 60 * 60 * 1000) card.hidden = true;
  }

  /* Show a random handful of the rumours, so the front page reads
     differently each visit. */
  function pickRumours() {
    var list = document.querySelector("[data-ch-rumours]");
    if (!list) return;
    var keep = parseInt(list.getAttribute("data-ch-rumours"), 10);
    var items = Array.prototype.slice.call(list.children);
    if (!keep || items.length <= keep) return;
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = items[i];
      items[i] = items[j];
      items[j] = swap;
    }
    items.slice(keep).forEach(function (item) {
      item.hidden = true;
    });
  }

  /*
   * The map card is filled in from the hexcrawl-map plugin's JSON, and stays
   * hidden if that plugin is not installed or its data cannot be read. The
   * explored/latest/image fields are newer than the plugin itself, so each
   * one is optional.
   */
  function loadMap() {
    var card = document.querySelector("[data-ch-map]");
    if (!card || !window.fetch) return;
    fetch(card.getAttribute("data-ch-map"), { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object") throw new Error("no data");

        var explored = Array.isArray(data.explored)
          ? data.explored.length
          : typeof data.explored === "number"
          ? data.explored
          : null;
        var total =
          typeof data.total === "number"
            ? data.total
            : Array.isArray(data.hexes)
            ? data.hexes.length
            : null;

        if (explored === null) throw new Error("no explored count");
        setText(card, "[data-ch-map-explored]", String(explored));
        setText(card, "[data-ch-map-total]", total ? "/ " + total : "");

        var latest = data.latest;
        var latestEl = card.querySelector("[data-ch-map-latest]");
        if (latestEl && latest && latest.hex !== undefined && latest.hex !== null) {
          latestEl.textContent = "";
          latestEl.appendChild(document.createTextNode("Latest: "));
          var noteUrl = card.getAttribute("data-ch-map-note");
          var label = "Hex " + latest.hex;
          if (noteUrl) {
            var link = document.createElement("a");
            link.href = noteUrl + "?hex=" + encodeURIComponent(latest.hex);
            link.textContent = label;
            latestEl.appendChild(link);
          } else {
            latestEl.appendChild(document.createTextNode(label));
          }
          if (latest.title) {
            latestEl.appendChild(document.createTextNode(" · " + latest.title));
          }
          latestEl.hidden = false;
        }

        var image = card.querySelector(".ch-map-image");
        if (image && typeof data.image === "string" && data.image) {
          image.src = data.image;
          image.alt = "The map, as far as it has been explored";
          image.hidden = false;
        }

        card.hidden = false;
      })
      .catch(function () {
        /* No map plugin, or nothing useful in its data: leave the card out. */
      });
  }

  function setText(root, selector, value) {
    var el = root.querySelector(selector);
    if (el) el.textContent = value;
  }

  function start() {
    if (!document.querySelector(".campaign-hub")) return;
    try {
      hidePastSession();
      pickRumours();
      loadMap();
    } catch (error) {
      /* Never let the hub break the rest of the page. */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
