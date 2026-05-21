// Injects a "Server not found" popup over a real Google SERP when the page
// was reached via the DNF auto-search flow. The background script redirects
// failed navigations to google.com/search?q=…#sc-dnf=1&d=<host>&u=<failedUrl>;
// this script reads that marker and shows a floating card explaining the
// auto-search, with a search box and an opt-out checkbox.
//
// Runs at document_start so the hash marker is read before Google's own JS
// has a chance to rewrite the fragment.

(function () {
  const rawHash = location.hash || "";
  if (rawHash.indexOf("sc-dnf=1") === -1) return;

  // Parse the marker params out of the hash (everything after the first #).
  const params = new URLSearchParams(rawHash.replace(/^#/, ""));
  const domain = params.get("d") || "";
  const failedUrl = params.get("u") || "";
  const DNF_AUTOSEARCH_KEY = "settingDnfAutoSearch";

  const MINI_GOOGLE = `<svg viewBox="0 0 18 18" width="14" height="14"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A8.99 8.99 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/></svg>`;

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setAutoSearch(on) {
    try {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        browser.storage.local.set({ [DNF_AUTOSEARCH_KEY]: on });
      }
    } catch (e) {}
  }

  const STYLE = `
    .sc-dnf-overlay {
      position: fixed;
      top: 9px;
      left: 50%;
      transform: translate(-50%, 0);
      animation: sc-dnf-float 2.6s ease-in-out infinite;
      transition: transform 500ms ease-out;
      z-index: 2147483647;
      width: 320px;
      padding: 16px 18px 14px;
      background: #fff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      color: #15141a;
    }
    @keyframes sc-dnf-float {
      0%, 100% { transform: translate(-50%, 0); }
      50%      { transform: translate(-50%, 5px); }
    }
    .sc-dnf-overlay::before, .sc-dnf-overlay::after {
      content: ""; position: absolute; bottom: 100%; left: 50%;
      width: 0; height: 0; border-style: solid;
    }
    .sc-dnf-overlay::before {
      margin-left: -9px; border-width: 0 9px 9px 9px;
      border-color: transparent transparent rgba(0,0,0,0.12) transparent;
    }
    .sc-dnf-overlay::after {
      margin-left: -8px; margin-bottom: -1px; border-width: 0 8px 8px 8px;
      border-color: transparent transparent #fff transparent;
    }
    .sc-dnf-close {
      position: absolute; top: 8px; right: 8px;
      appearance: none; background: none; border: none; padding: 0;
      width: 22px; height: 22px; font-size: 14px; line-height: 1;
      color: #6b6b6b; cursor: pointer; border-radius: 4px;
    }
    .sc-dnf-close:hover { background: rgba(0,0,0,0.06); color: #15141a; }
    .sc-dnf-head { display: flex; align-items: center; gap: 18px; margin-bottom: 12px; }
    .sc-dnf-head img { flex: none; width: 56px; height: auto; margin-left: 8px; }
    .sc-dnf-head h2 {
      margin: 0; flex: 1; min-width: 0; font-size: 19px; font-weight: 300;
      color: #15141a; letter-spacing: -0.01em; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sc-dnf-search {
      display: flex; align-items: center; gap: 8px; margin: 6px 0 14px;
      padding: 8px 11px; background: #fff; border: 1px solid #ccc;
      border-radius: 999px; box-shadow: 0 0 4px rgba(0,0,0,0.04);
    }
    .sc-dnf-search:focus-within { border-color: #0061e0; box-shadow: 0 0 0 3px rgba(0,97,224,0.18); }
    .sc-dnf-engine {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 50%;
    }
    .sc-dnf-search input {
      flex: 1; min-width: 0; padding: 2px 0; font: inherit; font-size: 14px;
      font-weight: 600; color: #15141a; background: transparent; border: none; outline: none;
    }
    .sc-dnf-search input::placeholder { color: #b8b8c0; font-weight: 400; }
    .sc-dnf-search button {
      flex: none; padding: 5px 12px; font: inherit; font-size: 12px; font-weight: 600;
      color: #fff; background: #0061e0; border: none; border-radius: 999px; cursor: pointer;
    }
    .sc-dnf-search button:hover { filter: brightness(1.05); }
    .sc-dnf-overlay label {
      display: flex; align-items: center; gap: 6px; font-size: 11px; color: #5b5b66; cursor: default;
    }
    .sc-dnf-overlay label input { margin: 0; width: 12px; height: 12px; accent-color: #0061e0; }
  `;

  function build() {
    if (document.getElementById("sc-dnf-overlay")) return;

    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const card = document.createElement("div");
    card.className = "sc-dnf-overlay";
    card.id = "sc-dnf-overlay";
    card.setAttribute("role", "dialog");
    const foxSrc = browser.runtime.getURL("images/no-connection.svg");
    const query = new URLSearchParams(location.search).get("q") || "";
    card.innerHTML = `
      <button type="button" class="sc-dnf-close" aria-label="Dismiss">✕</button>
      <div class="sc-dnf-head">
        <img src="${foxSrc}" alt="" />
        <h2>Server not found:<br><strong>${escapeHtml(domain || "the requested address")}</strong></h2>
      </div>
      <form class="sc-dnf-search">
        <span class="sc-dnf-engine" aria-hidden="true">${MINI_GOOGLE}</span>
        <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search with Google" autocomplete="off" />
        <button type="submit">Search</button>
      </form>
      <label>
        <input type="checkbox" checked />
        Search automatically when Firefox can’t find a server
      </label>
    `;
    document.body.appendChild(card);

    // Dismiss.
    card.querySelector(".sc-dnf-close").addEventListener("click", () => card.remove());

    // Opt-out: unchecking turns auto-search off so the next DNF shows the
    // standalone sim page again; re-checking turns it back on.
    const optOut = card.querySelector("label input");
    optOut.addEventListener("change", () => setAutoSearch(optOut.checked));

    // Re-run the search from the box.
    const form = card.querySelector(".sc-dnf-search");
    const input = form.querySelector('input[name="q"]');
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (input.value || "").trim();
      if (!q) return;
      location.href = "https://www.google.com/search?q=" + encodeURIComponent(q);
    });

    // Ease the float to a stop when the search box is focused (matches the
    // sim-page behaviour). Freeze at the live transform, then transition to
    // the nearest extreme.
    input.addEventListener("focus", () => {
      // Select the whole query so the user can immediately retype.
      input.select();
      if (card.style.animation === "none") return;
      const anim = card.getAnimations && card.getAnimations()[0];
      let targetY = 0;
      if (anim && typeof anim.currentTime === "number") {
        const dur = (anim.effect && anim.effect.getTiming && anim.effect.getTiming().duration) || 2600;
        targetY = ((anim.currentTime % dur) / dur) < 0.5 ? 5 : 0;
      }
      const live = getComputedStyle(card).transform;
      card.style.transform = live === "none" ? "translate(-50%, 0)" : live;
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.transform = `translate(-50%, ${targetY}px)`;
    });
    input.addEventListener("blur", () => {
      if (!document.hasFocus()) return;
      card.style.transform = "";
      card.style.animation = "";
    });
  }

  if (document.body) {
    build();
  } else {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  }
})();
