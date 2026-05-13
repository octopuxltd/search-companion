// Side-by-side split view of two simulated search engines. Each pane points
// at sim.html?kind=...&q=... — sim.js does all the rendering. Real Google /
// Bing block themselves from being iframed (X-Frame-Options / frame-ancestors),
// so we use our own pages instead.

const params = new URLSearchParams(location.search);
const query = params.get("q") || "";
const leftId = params.get("left") || "google";
const rightId = params.get("right") || "bing";
const domain = params.get("domain") || "";

document.title = "Split view: " + (query || "search");

function simURL(kind) {
  const p = new URLSearchParams({ kind, q: query });
  if (domain) p.set("domain", domain);
  return "sim.html?" + p.toString();
}

// Stagger each iframe with its own random "network" delay so neither side
// feels in lockstep. The iframes stay at about:blank until src is set.
const leftDelay = 120 + Math.random() * 480;
let rightDelay = 120 + Math.random() * 480;
while (Math.abs(leftDelay - rightDelay) < 120) {
  rightDelay = 120 + Math.random() * 480;
}
setTimeout(() => { document.getElementById("left").src = simURL(leftId); }, leftDelay);
setTimeout(() => { document.getElementById("right").src = simURL(rightId); }, rightDelay);
