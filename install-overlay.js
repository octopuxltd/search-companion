// Runs on the install page (octopuxltd.github.io/search-companion/) when the
// extension is installed. Adds a small "(you're on vX.X.X)" line under the
// version-to-install so the user can compare.
(function () {
  if (typeof browser === "undefined" || !browser.runtime || !browser.runtime.getManifest) return;
  const v = browser.runtime.getManifest().version;
  const wrap = document.querySelector(".wrap");
  const versionNode = document.querySelector(".version");
  if (!wrap || !versionNode) return;

  const here = document.createElement("div");
  here.className = "currently";
  here.textContent = `(you're on v${v})`;
  versionNode.insertAdjacentElement("afterend", here);

  // Match the page's existing muted style; let the page's stylesheet style it
  // by default, but provide a safe fallback inline.
  here.style.fontSize = "13px";
  here.style.color = "var(--accent, #1a73e8)";
  here.style.marginTop = "2px";
})();
