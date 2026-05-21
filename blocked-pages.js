// Pages we never send to the AI for content analysis.
//
// Three sources combined:
//   • Protocols / hosts that aren't web content (about:, file:, local IPs)
//   • Subdomain prefixes that indicate non-content surfaces (admin, mail,
//     auth, etc.)
//   • Path prefixes that indicate non-content surfaces (/checkout, /login,
//     /billing, etc.)
//
// Mirrors the pattern set in the sibling backchannel project's Supabase
// blocked_patterns table. Update both in lock-step when adding new rules.
// A list of full domains will be added below once provided.

const BLOCKED_PROTOCOLS = [
  "about:", "moz-extension:", "chrome-extension:", "file:", "data:", "javascript:",
];

const BLOCKED_HOST_PATTERNS = [
  /^localhost(:\d+)?$/,
  /^127\.\d+\.\d+\.\d+(:\d+)?$/,
  /^192\.168\.\d+\.\d+(:\d+)?$/,
  /^10\.\d+\.\d+\.\d+(:\d+)?$/,
];

const BLOCKED_PATTERNS = [
  // Subdomain prefixes — match host whose leftmost label equals the pattern.
  { reason: "accounts pages",            type: "subdomain_prefix", pattern: "account" },
  { reason: "accounts pages",            type: "subdomain_prefix", pattern: "accounts" },
  { reason: "sign-in pages",             type: "subdomain_prefix", pattern: "auth" },
  { reason: "sign-in pages",             type: "subdomain_prefix", pattern: "login" },
  { reason: "sign-in pages",             type: "subdomain_prefix", pattern: "signin" },
  { reason: "sign-in pages",             type: "subdomain_prefix", pattern: "sso" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "admin" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "dashboard" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "console" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "manage" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "portal" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "backstage" },
  { reason: "admin pages",               type: "subdomain_prefix", pattern: "internal" },
  { reason: "email pages",               type: "subdomain_prefix", pattern: "mail" },
  { reason: "email pages",               type: "subdomain_prefix", pattern: "inbox" },
  { reason: "email pages",               type: "subdomain_prefix", pattern: "webmail" },
  { reason: "API endpoints",             type: "subdomain_prefix", pattern: "api" },
  { reason: "non-page assets",           type: "subdomain_prefix", pattern: "cdn" },
  { reason: "non-page assets",           type: "subdomain_prefix", pattern: "static" },
  { reason: "non-page assets",           type: "subdomain_prefix", pattern: "assets" },

  // Path prefixes — match URLs whose pathname starts with the pattern.
  { reason: "admin pages",               type: "path_prefix", pattern: "/admin" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/wp-admin" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/wp-login" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/dashboard" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/manage" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/portal" },
  { reason: "admin pages",               type: "path_prefix", pattern: "/console" },
  { reason: "checkout and payment pages",type: "path_prefix", pattern: "/checkout" },
  { reason: "checkout and payment pages",type: "path_prefix", pattern: "/payment" },
  { reason: "accounts pages",            type: "path_prefix", pattern: "/account" },
  { reason: "accounts pages",            type: "path_prefix", pattern: "/accounts" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/signin" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/login" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/auth" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/sso" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/oauth" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/saml" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/logout" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/signout" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/sign-out" },
  { reason: "sign-up pages",             type: "path_prefix", pattern: "/register" },
  { reason: "sign-up pages",             type: "path_prefix", pattern: "/signup" },
  { reason: "sign-up pages",             type: "path_prefix", pattern: "/sign-up" },
  { reason: "password reset pages",      type: "path_prefix", pattern: "/password-reset" },
  { reason: "password reset pages",      type: "path_prefix", pattern: "/forgot-password" },
  { reason: "password reset pages",      type: "path_prefix", pattern: "/reset-password" },
  { reason: "verification pages",        type: "path_prefix", pattern: "/verify" },
  { reason: "verification pages",        type: "path_prefix", pattern: "/confirm" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/2fa" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/mfa" },
  { reason: "sign-in pages",             type: "path_prefix", pattern: "/totp" },
  { reason: "billing pages",             type: "path_prefix", pattern: "/billing" },
  { reason: "billing pages",             type: "path_prefix", pattern: "/invoices" },
  { reason: "billing pages",             type: "path_prefix", pattern: "/subscribe" },

  // --- Email providers ---------------------------------------------------
  { reason: "email pages",   type: "domain", pattern: "mail.google.com" },
  { reason: "email pages",   type: "domain", pattern: "gmail.com" },
  { reason: "email pages",   type: "domain", pattern: "outlook.com" },
  { reason: "email pages",   type: "domain", pattern: "outlook.live.com" },
  { reason: "email pages",   type: "domain", pattern: "outlook.office365.com" },
  { reason: "email pages",   type: "domain", pattern: "hotmail.com" },
  { reason: "email pages",   type: "domain", pattern: "msn.com" },
  { reason: "email pages",   type: "domain", pattern: "mail.yahoo.com" },
  { reason: "email pages",   type: "domain", pattern: "ymail.com" },
  { reason: "email pages",   type: "domain", pattern: "aol.com" },
  { reason: "email pages",   type: "domain", pattern: "mail.com" },
  { reason: "email pages",   type: "domain", pattern: "mail.ru" },
  { reason: "email pages",   type: "domain", pattern: "yandex.ru" },
  { reason: "email pages",   type: "domain", pattern: "yandex.com" },
  { reason: "email pages",   type: "domain", pattern: "gmx.com" },
  { reason: "email pages",   type: "domain", pattern: "gmx.de" },
  { reason: "email pages",   type: "domain", pattern: "gmx.net" },
  { reason: "email pages",   type: "domain", pattern: "web.de" },
  { reason: "email pages",   type: "domain", pattern: "qq.com" },
  { reason: "email pages",   type: "domain", pattern: "163.com" },
  { reason: "email pages",   type: "domain", pattern: "126.com" },
  { reason: "email pages",   type: "domain", pattern: "foxmail.com" },
  { reason: "email pages",   type: "domain", pattern: "sina.com" },
  { reason: "email pages",   type: "domain", pattern: "laposte.net" },
  { reason: "email pages",   type: "domain", pattern: "free.fr" },
  { reason: "email pages",   type: "domain", pattern: "sfr.fr" },
  { reason: "email pages",   type: "domain", pattern: "orange.fr" },
  { reason: "email pages",   type: "domain", pattern: "wanadoo.fr" },
  { reason: "email pages",   type: "domain", pattern: "btinternet.com" },
  { reason: "email pages",   type: "domain", pattern: "t-online.de" },
  { reason: "email pages",   type: "domain", pattern: "mail.proton.me" },
  { reason: "email pages",   type: "domain", pattern: "protonmail.com" },
  { reason: "email pages",   type: "domain", pattern: "proton.me" },
  { reason: "email pages",   type: "domain", pattern: "tutanota.com" },
  { reason: "email pages",   type: "domain", pattern: "tuta.com" },
  { reason: "email pages",   type: "domain", pattern: "fastmail.com" },
  { reason: "email pages",   type: "domain", pattern: "fastmail.fm" },
  { reason: "email pages",   type: "domain", pattern: "hey.com" },
  { reason: "email pages",   type: "domain", pattern: "posteo.de" },
  { reason: "email pages",   type: "domain", pattern: "mailbox.org" },
  { reason: "email pages",   type: "domain", pattern: "runbox.com" },
  { reason: "email pages",   type: "domain", pattern: "mailfence.com" },
  { reason: "email pages",   type: "domain", pattern: "startmail.com" },
  { reason: "email pages",   type: "domain", pattern: "mail.apple.com" },
  { reason: "email pages",   type: "domain", pattern: "zoho.com" },

  // --- Messaging / chat --------------------------------------------------
  { reason: "messaging pages", type: "domain", pattern: "web.whatsapp.com" },
  { reason: "messaging pages", type: "domain", pattern: "web.telegram.org" },
  { reason: "messaging pages", type: "domain", pattern: "messages.google.com" },
  { reason: "messaging pages", type: "domain", pattern: "messenger.com" },
  { reason: "messaging pages", type: "domain", pattern: "slack.com" },
  { reason: "messaging pages", type: "domain", pattern: "element.io" },
  { reason: "messaging pages", type: "domain", pattern: "app.element.io" },
  { reason: "messaging pages", type: "domain", pattern: "wire.com" },
  { reason: "messaging pages", type: "domain", pattern: "signal.org" },
  { reason: "messaging pages", type: "domain", pattern: "simplex.chat" },
  { reason: "messaging pages", type: "domain", pattern: "teams.microsoft.com" },
  { reason: "messaging pages", type: "domain", pattern: "discord.com" },
  { reason: "messaging pages", type: "domain", pattern: "web.wechat.com" },
  { reason: "messaging pages", type: "domain", pattern: "kakao.com" },
  { reason: "messaging pages", type: "domain", pattern: "viber.com" },
  { reason: "messaging pages", type: "domain", pattern: "keybase.io" },
  { reason: "messaging pages", type: "domain", pattern: "gitter.im" },
  { reason: "messaging pages", type: "domain", pattern: "guilded.gg" },
  { reason: "messaging pages", type: "domain", pattern: "mattermost.com" },
  { reason: "messaging pages", type: "domain", pattern: "zulip.com" },
  { reason: "messaging pages", type: "domain", pattern: "zulipchat.com" },
  { reason: "messaging pages", type: "domain", pattern: "wickr.com" },

  // --- Banks (UK) --------------------------------------------------------
  { reason: "banking pages", type: "domain", pattern: "barclays.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "hsbc.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "lloyds.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "natwest.com" },
  { reason: "banking pages", type: "domain", pattern: "santander.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "nationwide.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "firstdirect.com" },
  { reason: "banking pages", type: "domain", pattern: "virginmoney.com" },
  { reason: "banking pages", type: "domain", pattern: "monzo.com" },
  { reason: "banking pages", type: "domain", pattern: "starlingbank.com" },
  { reason: "banking pages", type: "domain", pattern: "revolut.com" },
  { reason: "banking pages", type: "domain", pattern: "co-operativebank.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "metrobank.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "tescobank.com" },
  { reason: "banking pages", type: "domain", pattern: "halifax.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "tsb.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "yorkshirebank.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "clydesdalebank.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "skiptonbs.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "coventrybuildingsociety.co.uk" },

  // --- Banks (US) --------------------------------------------------------
  { reason: "banking pages", type: "domain", pattern: "chase.com" },
  { reason: "banking pages", type: "domain", pattern: "bankofamerica.com" },
  { reason: "banking pages", type: "domain", pattern: "wellsfargo.com" },
  { reason: "banking pages", type: "domain", pattern: "citi.com" },
  { reason: "banking pages", type: "domain", pattern: "jpmorganchase.com" },
  { reason: "banking pages", type: "domain", pattern: "morganstanley.com" },
  { reason: "banking pages", type: "domain", pattern: "goldmansachs.com" },
  { reason: "banking pages", type: "domain", pattern: "tdbank.com" },
  { reason: "banking pages", type: "domain", pattern: "pnc.com" },
  { reason: "banking pages", type: "domain", pattern: "truist.com" },
  { reason: "banking pages", type: "domain", pattern: "usbank.com" },
  { reason: "banking pages", type: "domain", pattern: "ally.com" },
  { reason: "banking pages", type: "domain", pattern: "capitalone.com" },

  // --- Banks (AU / CA / EU) ----------------------------------------------
  { reason: "banking pages", type: "domain", pattern: "commbank.com.au" },
  { reason: "banking pages", type: "domain", pattern: "westpac.com.au" },
  { reason: "banking pages", type: "domain", pattern: "nab.com.au" },
  { reason: "banking pages", type: "domain", pattern: "anz.com.au" },
  { reason: "banking pages", type: "domain", pattern: "rbc.com" },
  { reason: "banking pages", type: "domain", pattern: "scotiabank.com" },
  { reason: "banking pages", type: "domain", pattern: "td.com" },
  { reason: "banking pages", type: "domain", pattern: "bmo.com" },
  { reason: "banking pages", type: "domain", pattern: "cibc.com" },
  { reason: "banking pages", type: "domain", pattern: "db.com" },
  { reason: "banking pages", type: "domain", pattern: "ing.com" },
  { reason: "banking pages", type: "domain", pattern: "bnpparibas.fr" },
  { reason: "banking pages", type: "domain", pattern: "societegenerale.fr" },
  { reason: "banking pages", type: "domain", pattern: "santander.com" },

  // --- Credit cards / brokerage / investment -----------------------------
  { reason: "banking pages", type: "domain", pattern: "americanexpress.com" },
  { reason: "banking pages", type: "domain", pattern: "amex.com" },
  { reason: "banking pages", type: "domain", pattern: "discover.com" },
  { reason: "banking pages", type: "domain", pattern: "barclaycard.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "fidelity.com" },
  { reason: "banking pages", type: "domain", pattern: "schwab.com" },
  { reason: "banking pages", type: "domain", pattern: "vanguard.com" },
  { reason: "banking pages", type: "domain", pattern: "etrade.com" },
  { reason: "banking pages", type: "domain", pattern: "robinhood.com" },
  { reason: "banking pages", type: "domain", pattern: "sofi.com" },
  { reason: "banking pages", type: "domain", pattern: "interactivebrokers.com" },
  { reason: "banking pages", type: "domain", pattern: "hargreaveslansdown.co.uk" },
  { reason: "banking pages", type: "domain", pattern: "ajbell.co.uk" },

  // --- Payment / wallet services -----------------------------------------
  { reason: "payment pages", type: "domain", pattern: "paypal.com" },
  { reason: "payment pages", type: "domain", pattern: "venmo.com" },
  { reason: "payment pages", type: "domain", pattern: "cashapp.com" },
  { reason: "payment pages", type: "domain", pattern: "stripe.com" },
  { reason: "payment pages", type: "domain", pattern: "wise.com" },
  { reason: "payment pages", type: "domain", pattern: "klarna.com" },
  { reason: "payment pages", type: "domain", pattern: "alipay.com" },
  { reason: "payment pages", type: "domain", pattern: "skrill.com" },
  { reason: "payment pages", type: "domain", pattern: "payoneer.com" },

  // --- Crypto exchanges / wallets ----------------------------------------
  { reason: "crypto pages", type: "domain", pattern: "coinbase.com" },
  { reason: "crypto pages", type: "domain", pattern: "binance.com" },
  { reason: "crypto pages", type: "domain", pattern: "binance.us" },
  { reason: "crypto pages", type: "domain", pattern: "kraken.com" },
  { reason: "crypto pages", type: "domain", pattern: "crypto.com" },
  { reason: "crypto pages", type: "domain", pattern: "gemini.com" },
  { reason: "crypto pages", type: "domain", pattern: "bitfinex.com" },
  { reason: "crypto pages", type: "domain", pattern: "blockchain.com" },
  { reason: "crypto pages", type: "domain", pattern: "metamask.io" },

  // --- Password managers -------------------------------------------------
  { reason: "password manager pages", type: "domain", pattern: "1password.com" },
  { reason: "password manager pages", type: "domain", pattern: "lastpass.com" },
  { reason: "password manager pages", type: "domain", pattern: "bitwarden.com" },
  { reason: "password manager pages", type: "domain", pattern: "vault.bitwarden.com" },
  { reason: "password manager pages", type: "domain", pattern: "dashlane.com" },
  { reason: "password manager pages", type: "domain", pattern: "keepersecurity.com" },
  { reason: "password manager pages", type: "domain", pattern: "nordpass.com" },

  // --- Cloud storage -----------------------------------------------------
  { reason: "cloud storage pages", type: "domain", pattern: "drive.google.com" },
  { reason: "cloud storage pages", type: "domain", pattern: "dropbox.com" },
  { reason: "cloud storage pages", type: "domain", pattern: "onedrive.live.com" },
  { reason: "cloud storage pages", type: "domain", pattern: "icloud.com" },
  { reason: "cloud storage pages", type: "domain", pattern: "box.com" },
  { reason: "cloud storage pages", type: "domain", pattern: "mega.nz" },

  // --- Cloud office / personal documents ---------------------------------
  { reason: "cloud document pages", type: "domain", pattern: "docs.google.com" },
  { reason: "cloud document pages", type: "domain", pattern: "sheets.google.com" },
  { reason: "cloud document pages", type: "domain", pattern: "slides.google.com" },
  { reason: "cloud document pages", type: "domain", pattern: "notion.so" },
  { reason: "cloud document pages", type: "domain", pattern: "evernote.com" },
  { reason: "cloud document pages", type: "domain", pattern: "airtable.com" },
  { reason: "cloud document pages", type: "domain", pattern: "office.com" },
  { reason: "cloud document pages", type: "domain", pattern: "word.office.com" },
  { reason: "cloud document pages", type: "domain", pattern: "excel.office.com" },

  // --- Calendar ----------------------------------------------------------
  { reason: "calendar pages", type: "domain", pattern: "calendar.google.com" },

  // --- Tax / accounting --------------------------------------------------
  { reason: "tax and accounting pages", type: "domain", pattern: "turbotax.intuit.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "intuit.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "quickbooks.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "xero.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "freeagent.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "hrblock.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "freetaxusa.com" },
  { reason: "tax and accounting pages", type: "domain", pattern: "sage.com" },

  // --- Healthcare --------------------------------------------------------
  { reason: "healthcare pages", type: "domain", pattern: "mychart.com" },
  { reason: "healthcare pages", type: "domain", pattern: "kp.org" },
  { reason: "healthcare pages", type: "domain", pattern: "23andme.com" },
  { reason: "healthcare pages", type: "domain", pattern: "ancestry.com" },
  { reason: "healthcare pages", type: "domain", pattern: "myuhc.com" },
  { reason: "healthcare pages", type: "domain", pattern: "aetna.com" },
  { reason: "healthcare pages", type: "domain", pattern: "cigna.com" },
  { reason: "healthcare pages", type: "domain", pattern: "anthem.com" },
  { reason: "healthcare pages", type: "domain", pattern: "bluecrossblueshield.com" },

  // --- Government / identity ---------------------------------------------
  { reason: "government pages", type: "domain", pattern: "account.gov.uk" },
  { reason: "government pages", type: "domain", pattern: "sign-in.service.gov.uk" },
  { reason: "government pages", type: "domain", pattern: "hmrc.gov.uk" },
  { reason: "government pages", type: "domain", pattern: "dvla.gov.uk" },
  { reason: "government pages", type: "domain", pattern: "login.gov" },
  { reason: "government pages", type: "domain", pattern: "id.me" },
  { reason: "government pages", type: "domain", pattern: "irs.gov" },
  { reason: "government pages", type: "domain", pattern: "ssa.gov" },
  { reason: "government pages", type: "domain", pattern: "myaccount.usa.gov" },

  // --- Authentication gateways -------------------------------------------
  { reason: "sign-in pages", type: "domain", pattern: "accounts.google.com" },
  { reason: "sign-in pages", type: "domain", pattern: "login.microsoftonline.com" },
  { reason: "sign-in pages", type: "domain", pattern: "login.live.com" },
  { reason: "sign-in pages", type: "domain", pattern: "login.yahoo.com" },
  { reason: "sign-in pages", type: "domain", pattern: "login.salesforce.com" },

  // --- Insurance ---------------------------------------------------------
  { reason: "insurance pages", type: "domain", pattern: "geico.com" },
  { reason: "insurance pages", type: "domain", pattern: "statefarm.com" },
  { reason: "insurance pages", type: "domain", pattern: "allstate.com" },
  { reason: "insurance pages", type: "domain", pattern: "progressive.com" },
  { reason: "insurance pages", type: "domain", pattern: "aviva.co.uk" },
  { reason: "insurance pages", type: "domain", pattern: "axa.co.uk" },
  { reason: "insurance pages", type: "domain", pattern: "directline.com" },

  // --- SSO / corporate apps ----------------------------------------------
  { reason: "single sign-on pages", type: "domain", pattern: "okta.com" },
  { reason: "single sign-on pages", type: "domain", pattern: "oktapreview.com" },
  { reason: "single sign-on pages", type: "domain", pattern: "duo.com" },
  { reason: "single sign-on pages", type: "domain", pattern: "duosecurity.com" },
  { reason: "video conferencing pages", type: "domain", pattern: "zoom.us" },
  { reason: "video conferencing pages", type: "domain", pattern: "zoom.com" },
  { reason: "video conferencing pages", type: "domain", pattern: "zoomgov.com" },
  { reason: "corporate app pages", type: "domain", pattern: "salesforce.com" },
  { reason: "corporate app pages", type: "domain", pattern: "force.com" },

  // --- Team collaboration / code / issue tracking ------------------------
  // atlassian.net covers Jira Cloud + Confluence Cloud at <tenant>.atlassian.net;
  // atlassian.com covers their account / billing / marketing surfaces.
  { reason: "design tool pages",      type: "domain", pattern: "figma.com" },
  { reason: "team collaboration pages", type: "domain", pattern: "atlassian.net" },
  { reason: "team collaboration pages", type: "domain", pattern: "atlassian.com" },
  { reason: "code repository pages",  type: "domain", pattern: "github.com" },
  { reason: "bug tracker pages",      type: "domain", pattern: "bugzilla.mozilla.org" },
];

// --- Allow-list model -----------------------------------------------------
//
// The prototype now uses a WHITELIST: page content is sent to the AI only
// when the page's domain is on the allow-list. Everything else is skipped.
// The big BLOCKED_PATTERNS table above is no longer consulted for gating —
// it's retained for reference / possible future use (e.g. excluding auth
// or checkout paths even within an allowed shop).
//
// DEFAULT_ALLOWED_DOMAINS seeds the user's editable list on first run. It's
// duplicated in sidebar/sidebar.js (setupAllowedDomainsUI) so the Settings
// preview can seed itself without the background script — keep both in
// lock-step. Entries ending in ".*" match any public suffix, so "amazon.*"
// covers amazon.com, amazon.co.uk, amazon.ca, smile.amazon.com, etc.
const DEFAULT_ALLOWED_DOMAINS = [
  "amazon.*",
  "walmart.*",
  "target.com",
  "bestbuy.*",
  "costco.*",
  "ebay.*",
  "etsy.com",
  "wayfair.*",
  "ikea.com",
  "newegg.*",
  "homedepot.*",
  "lowes.*",
  "staples.*",
  "canadiantire.ca",
  "thebay.com",
  "bhphotovideo.com",
  "argos.co.uk",
  "johnlewis.com",
  "currys.co.uk",
];

// Per-user allow-list, mirrored from storage.local by background.js (seeded
// with DEFAULT_ALLOWED_DOMAINS on first run). Kept in memory so the gate
// below stays synchronous.
let USER_ALLOWED_DOMAINS = [];
function setUserAllowedDomains(list) {
  USER_ALLOWED_DOMAINS = Array.isArray(list)
    ? list.map((d) => String(d || "").trim().toLowerCase()).filter(Boolean)
    : [];
}

// True if `hostname` (already www-stripped, lowercased) matches an allow-list
// `pattern`. "shop.*" matches shop.com / shop.co.uk / sub.shop.com; a plain
// "shop.com" matches the host itself and any subdomain.
function domainMatchesAllow(hostname, pattern) {
  if (!pattern) return false;
  if (pattern.endsWith(".*")) {
    const base = pattern.slice(0, -2);
    return hostname.startsWith(base + ".") || hostname.includes("." + base + ".");
  }
  return hostname === pattern || hostname.endsWith("." + pattern);
}

// Returns a short reason string if the URL should NOT be analysed by AI,
// or null if it's allowed. Allow-list based: only listed shopping domains
// are sent; everything else is skipped.
function isBlockedForAI(url) {
  if (!url) return "no url";
  if (BLOCKED_PROTOCOLS.some((p) => url.startsWith(p))) return "system page";

  let parsed;
  try { parsed = new URL(url); } catch { return "unparseable url"; }

  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(parsed.host))) return "local network";

  const hostname = parsed.hostname.replace(/^www\./, "");

  for (const d of USER_ALLOWED_DOMAINS) {
    if (domainMatchesAllow(hostname, d)) return null;
  }

  return "not an allowed site";
}
