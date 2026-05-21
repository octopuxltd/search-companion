// Side-by-side split view of two simulated search engines. Each pane points
// at sim.html?kind=...&q=... — sim.js does all the rendering. Real Google /
// Bing block themselves from being iframed (X-Frame-Options / frame-ancestors),
// so we use our own pages instead.

const params = new URLSearchParams(location.search);
const query = params.get("q") || "";
const leftId = params.get("left") || "google";
const rightId = params.get("right") || "bing";
const domain = params.get("domain") || "";
// Forwarded to the left iframe so the DNF page can render the matching
// consent variant (the right pane is suppressed when consent === "none").
const consent = params.get("consent") === "none" ? "none" : "given";

document.title = "Split view: " + (query || "search");

function simURL(kind, extra) {
  const p = new URLSearchParams({ kind, q: query });
  if (domain) p.set("domain", domain);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
  }
  return "sim.html?" + p.toString();
}

// Stagger each iframe with its own random "network" delay so neither side
// feels in lockstep. The iframes stay at about:blank until src is set.
const leftDelay = 120 + Math.random() * 480;
let rightDelay = 120 + Math.random() * 480;
while (Math.abs(leftDelay - rightDelay) < 120) {
  rightDelay = 120 + Math.random() * 480;
}
setTimeout(() => { document.getElementById("left").src = simURL(leftId, { consent }); }, leftDelay);
// `right=blank` (used by the No-consent DNF variant) leaves the right pane
// empty — the search hasn't run, so there are no results to show.
if (rightId !== "blank") {
  setTimeout(() => { document.getElementById("right").src = simURL(rightId); }, rightDelay);
}

// Render the prototype-view footer at the top level so it sits dead-centre
// of the whole window rather than inside one of the iframes. The two options
// flip between consent variants — clicking the unpressed one navigates the
// top window to the matching destination.
function buildHref(nextConsent) {
  const p = new URLSearchParams({ kind: "firefox-dnf", q: query, consent: nextConsent });
  if (domain) p.set("domain", domain);
  if (nextConsent === "given") {
    return "split-view.html?" + new URLSearchParams({
      q: query, left: "firefox-dnf", right: "google-didyoumean", domain, consent: "given",
    }).toString();
  }
  return "sim.html?" + p.toString();
}
const pv = document.getElementById("protoView");
const noConsentSlot = document.getElementById("protoNoConsent");
const givenSlot = document.getElementById("protoGiven");
if (pv && noConsentSlot && givenSlot) {
  if (consent === "given") {
    noConsentSlot.outerHTML = `<a href="${buildHref("none")}" class="proto-link">No consent yet</a>`;
    givenSlot.outerHTML = `<span class="proto-current">Consent given</span>`;
  } else {
    noConsentSlot.outerHTML = `<span class="proto-current">No consent yet</span>`;
    givenSlot.outerHTML = `<a href="${buildHref("given")}" class="proto-link">Consent given</a>`;
  }
  pv.hidden = false;
}
