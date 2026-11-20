// v335 (Ravi: iPhone App Store app with the app's files INSIDE the app, so it opens loaded even with no internet).
//
// The iPhone app is a Capacitor shell (folder ios-app/) that carries this same web build (dist/) inside it and
// shows it from the phone (capacitor://localhost). Everything that used to be "the same website" now has to say
// WHERE the server is. This file is the one place that knows:
//   - isNative()          → running inside the Capacitor app (iPhone; Android later if wanted)
//   - API_ORIGIN          → the live server (build-time VITE_API_ORIGIN, default https://ybexmedia.in)
//   - apiUrl(path)        → "/api/x" → "https://ybexmedia.in/api/x" inside the app, unchanged on the website
//   - openOAuth(url)      → Google / Apple sign-in in the phone's own browser sheet (Google blocks in-app web views),
//                           and back into the app through the link com.ybex.app://oauth#token=…
// On the website nothing here changes behaviour (isNative() is false).

// v337 (Ravi): the live server is ybexapp.ai.studio until ybexmedia.in is connected. Later the domain switch is ONE
// line here (or VITE_API_ORIGIN at build time) — iPhones get it through the live update, no App Store release.
const DEFAULT_ORIGIN = "https://ybexapp.ai.studio";
export const APP_SCHEME = "com.ybex.app";
/** v446: the "?…" part of an app link, without the "#…" part ("" when none). */
export function deepLinkQuery(url) {
  const u = String(url || "").split("#")[0];
  const i = u.indexOf("?");
  return i >= 0 && i < u.length - 1 ? u.slice(i) : "";
}

export function isNative() {
  try {
    const c = typeof window !== "undefined" ? window.Capacitor : null;
    return Boolean(c && (typeof c.isNativePlatform === "function" ? c.isNativePlatform() : c.isNative));
  } catch {
    return false;
  }
}

export function nativePlatform() {
  try { return isNative() ? String(window.Capacitor.getPlatform?.() || "") : "web"; } catch { return "web"; }
}

export const API_ORIGIN = (() => {
  let v = "";
  // v337: only VITE_API_ORIGIN (set on purpose) changes it — VITE_PUBLIC_SITE_URL is the share-link address and may name a
  // domain that isn't serving the app yet, which would send every iPhone to a dead server.
  try { v = (import.meta && import.meta.env && import.meta.env.VITE_API_ORIGIN) || ""; } catch { v = ""; }
  return String(v || DEFAULT_ORIGIN).replace(/\/+$/, "");
})();

// v466 (Ravi: "ybexmedia.in down ho toh yaha nahi toh vaha se la de"): backup server for the phone apps.
// ybexmedia.in (Cloudflare) and ybexapp.ai.studio are the same server. When the main address stops answering,
// src/lib/serverStatus.js checks the other one and, if it answers, the app switches to it (no restart, login kept —
// the session is a Bearer token). While on the backup, the main address is checked every 5 min and used again once
// it answers. Website: never switches (it always talks to the address it was opened from).
// v467: the backup is "the other one of the pair". Phone builds made without VITE_API_ORIGIN talk to ybexapp.ai.studio
// (ios-app/package.json default), and then the backup must be ybexmedia.in — with a fixed backup they were the same
// address and the switch never happened.
const ORIGIN_PAIR = ["https://ybexmedia.in", "https://ybexapp.ai.studio"];
export const BACKUP_ORIGIN = API_ORIGIN === ORIGIN_PAIR[1] ? ORIGIN_PAIR[0] : ORIGIN_PAIR[1];
let activeOrigin = API_ORIGIN;

/** true inside the phone app when a second address exists. */
export function canUseBackupOrigin() {
  return isNative() && BACKUP_ORIGIN !== API_ORIGIN;
}
/** The address the phone app talks to right now (main or backup). */
export function activeApiOrigin() {
  return activeOrigin;
}
/** The address that is NOT in use right now. */
export function otherApiOrigin() {
  return activeOrigin === API_ORIGIN ? BACKUP_ORIGIN : API_ORIGIN;
}
/** Switch main ↔ backup. Fires window "ybex:origin" { origin, backup } so the live connection (socket) moves too. */
export function setActiveApiOrigin(origin) {
  const o = String(origin || "").replace(/\/+$/, "");
  if (o !== API_ORIGIN && o !== BACKUP_ORIGIN) return false;
  if (o === activeOrigin) return false;
  activeOrigin = o;
  try { window.dispatchEvent(new CustomEvent("ybex:origin", { detail: { origin: o, backup: o !== API_ORIGIN } })); } catch { /* tests */ }
  return true;
}

/** Origin the app talks to: the live server inside the native app, the page's own origin on the website. */
export function serverOrigin() {
  if (isNative()) return activeOrigin;
  try { return window.location.origin; } catch { return API_ORIGIN; }
}

/** "/api/…" or "/uploads/…" → absolute server link inside the native app. Anything else is returned as it is. */
export function apiUrl(u) {
  if (typeof u !== "string" || !isNative()) return u;
  if (/^\/(api|uploads|socket\.io)(\/|\?|$)/.test(u)) return activeOrigin + u;
  return u;
}

const plugin = (name) => {
  try { return window.Capacitor?.Plugins?.[name] || null; } catch { return null; }
};

/** Opens a sign-in page. Website: same tab (as before). Native app: the phone's browser sheet. */
export async function openOAuth(url) {
  const Browser = plugin("Browser");
  if (isNative() && Browser?.open) {
    try { await Browser.open({ url, presentationStyle: "popover" }); return; } catch { /* fall back below */ }
  }
  window.location.href = url;
}

/** v449 (Ravi's video: "Open file" took the whole app to a supabase.co page and closing it restarted Ybex):
 *  inside the app a file / outside page opens in the phone's browser sheet over Ybex; on the website, a new tab. */
export async function openInSheet(url) {
  const Browser = plugin("Browser");
  if (isNative() && Browser?.open) {
    try { await Browser.open({ url, presentationStyle: "popover" }); return; } catch { /* fall back below */ }
  }
  try { window.open(url, "_blank", "noopener"); } catch { window.location.href = url; }
}

/**
 * v378 (Ravi: "dusre apps ki tarah phone ke Google accounts dikhao"): inside the Android / iPhone app, the phone's own
 * Google account picker (@capgo/capacitor-social-login, in app builds from v378). Returns { token, role } or null when
 * this app build doesn't have it / it isn't set up — then the caller uses the browser sign-in as before.
 * Throws { cancelled: true } when the person closed the picker.
 */
/** v468: may this iPhone app build open Google's own picker? Pure-ish (reads the build number). */
export async function iosPickerOk(cfg) {
  const min = Number(cfg?.ios_min_build) || 0;
  if (!cfg?.ios || min <= 0) return false;
  let build = 0;
  try { build = Number((await plugin("App")?.getInfo?.())?.build) || 0; } catch { build = 0; }
  return build >= min;
}

export async function nativeGoogleSignIn(role, opts = {}) {
  const SL = plugin("SocialLogin");
  if (!isNative() || !SL?.login || !SL?.initialize) return null;
  let cfg = null;
  try { cfg = await (await window.fetch("/api/auth/oauth/google/native-config")).json(); } catch { return null; }
  if (!cfg?.web) return null;
  // v468 (Ravi, TestFlight: "Sign in with Google pe click karte hi app crash" — iPhone and Mac): Google's in-app picker
  // kills the app when the build's Info.plist lacks the reversed-client-id link scheme (all builds up to now). The picker
  // runs only on builds made with it (mac-prepare.sh adds it) — the server says from which build number
  // (GOOGLE_IOS_PICKER_MIN_BUILD). Older builds keep the browser sheet, which works.
  if (nativePlatform() === "ios" && !(await iosPickerOk(cfg))) return null;
  try {
    await SL.initialize({ google: { webClientId: cfg.web, ...(cfg.ios ? { iOSClientId: cfg.ios, iOSServerClientId: cfg.web } : {}), mode: "online" } });
  } catch { return null; }
  let res;
  try {
    res = await SL.login({ provider: "google", options: { scopes: ["email", "profile"] } });
  } catch (e) {
    const m = String(e?.message || e || "").toLowerCase();
    if (/cancel/.test(m)) { const err = new Error("cancelled"); err.cancelled = true; throw err; }
    return null; // not configured on this build → browser sign-in
  }
  const idToken = res?.result?.idToken;
  if (!idToken) return null;
  const r = await window.fetch("/api/auth/oauth/google/native", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, role: role || "", ...(opts.join ? { join: true } : {}) }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok && data?.pending) return data; // v408: new Google account from the Join screen — no account yet
  if (!r.ok || !data?.token) { const err = new Error(data?.error || "google"); err.code = data?.error || "google"; throw err; }
  return data;
}

/** Extra query for /auth/oauth/url so the server sends the person back into the app, not to the website. */
export function oauthAppParams() {
  return isNative() ? { app: "native" } : {};
}

/** v377: px the page needs to move down on Android when it is drawn under the clock strip. Pure (tests). */
export function androidTopGap({ envTop = 0, innerHeight = 0, screenHeight = 0 } = {}) {
  if (envTop > 0) return 0; // the web view knows the gap → the env() paddings already work
  if (!innerHeight || !screenHeight) return 0;
  return innerHeight >= screenHeight - 2 ? 28 : 0; // page as tall as the whole screen = it sits under the strip
}

/** v468 (Ravi, TestFlight: "upar status bar ne pura mess kar diya"): the iPhone app draws the page under the clock
 *  (StatusBar overlaysWebView + contentInset "never"), but the screens are built for a page that starts below it.
 *  The gap is the phone's own safe-area top. Pure (tests). */
export function iosTopGap({ envTop = 0 } = {}) {
  const t = Math.round(Number(envTop) || 0);
  return t > 0 && t < 120 ? t : 0;
}

function iosStatusBarFallback() {
  const doc = document.documentElement;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const gap = iosTopGap({ envTop: probe.getBoundingClientRect().height || 0 });
  probe.remove();
  doc.style.setProperty("--yb-android-top", `${gap}px`);
  doc.classList.toggle("yb-sb-fallback", gap > 0);
}

function androidStatusBarFallback() {
  const doc = document.documentElement;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const envTop = probe.getBoundingClientRect().height || 0;
  probe.remove();
  const gap = androidTopGap({ envTop, innerHeight: window.innerHeight, screenHeight: window.screen?.height || 0 });
  doc.style.setProperty("--yb-android-top", `${gap}px`);
  doc.classList.toggle("yb-sb-fallback", gap > 0);
}

let installed = false;
/**
 * Call once at start-up (src/index.jsx). Inside the native app:
 *  - plain fetch("/api/…") calls go to the live server with the login token (axios is handled in lib/api.js);
 *  - links that come back into the app (com.ybex.app://oauth#token=…) close the browser sheet and open /app/oauth;
 *  - the Android back button goes back inside the app.
 */
/** v364: screens where Android Back puts the app in the background instead of going back. Pure. */
export function isRootPath(pathname) {
  const p = String(pathname || "/").replace(/\/+$/, "") || "/";
  return ["/", "/app", "/dashboard", "/brand/dashboard", "/creator/dashboard", "/login", "/signup", "/onboarding", "/admin"].includes(p);
}

/** v456: history entries the app itself made (sheets, steps, Eva, tour, UGC views, onboarding steps). Pure. */
export function isAppEntry(st) {
  if (!st || typeof st !== "object") return false;
  return Boolean((Array.isArray(st.ybexSheets) && st.ybexSheets.length) || st.ybexUgcView || st.ybexCreatorUgcView || st.eva || st.ybTour || st.ybexOnbPushed);
}

/**
 * v456: closes the popup on top (Razorpay checkout, or any [role=dialog] / [aria-modal] sheet) the way its own ✕ does.
 * Returns true when something was closed. Used by the Android Back so it never backgrounds the app over an open popup.
 */
export function closeTopPopup(doc) {
  try {
    if (!doc || !doc.querySelectorAll) return false;
    const shown = (el) => { const r = el.getBoundingClientRect?.(); const cs = doc.defaultView?.getComputedStyle?.(el); return Boolean(r && r.width > 0 && r.height > 0 && (!cs || (cs.display !== "none" && cs.visibility !== "hidden"))); };
    const rzp = [...doc.querySelectorAll(".razorpay-container")].find(shown);
    if (rzp) {
      // Razorpay's own Back handling (it pushes an entry) — step back so it closes like it does in a browser
      try { window.history.back(); } catch { /* ignore */ }
      return true;
    }
    const list = [...doc.querySelectorAll('[role="dialog"],[aria-modal="true"],[data-yb-popup]')].filter(shown);
    const top = list[list.length - 1];
    if (!top) return false;
    const btn = top.querySelector('[data-back-close],[data-testid$="close"],[data-testid$="-x"],button[aria-label^="Close" i],button[aria-label="Dismiss" i],button[aria-label="Not now" i]');
    if (btn) { btn.click(); return true; }
    const esc = { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true };
    top.dispatchEvent(new KeyboardEvent("keydown", esc));
    doc.dispatchEvent(new KeyboardEvent("keydown", esc));
    return true;
  } catch { return false; }
}

export function installNative() {
  if (installed || !isNative()) return;
  installed = true;
  try { document.documentElement.classList.add("yb-native", `yb-native-${nativePlatform()}`); } catch { /* ignore */ }

  // v377 (Ravi, Android screenshots: "header upar jaake chipak raha hai"): the Android app draws the page UNDER the
  // clock / battery strip, and Android's web view reports no safe-area gap, so every header sat under the clock.
  // On Android the page now starts below the strip; StatusBarSync paints the strip in the page's top colour.
  if (nativePlatform() === "android") {
    try { plugin("StatusBar")?.setOverlaysWebView?.({ overlay: false }); } catch { /* plugin not in this build */ }
    // Android 15+ draws apps edge-to-edge no matter what, and older Android web views report no safe-area gap. If
    // the page still covers the clock strip after the switch above, push the whole app down by the strip's height.
    const check = () => { try { androidStatusBarFallback(); } catch { /* ignore */ } };
    setTimeout(check, 400); setTimeout(check, 1500);
    try { window.addEventListener("resize", check); } catch { /* ignore */ }
  }

  // v468: same "start below the clock" on iPhone (see iosStatusBarFallback).
  if (nativePlatform() === "ios") {
    const checkIos = () => { try { iosStatusBarFallback(); } catch { /* ignore */ } };
    checkIos(); setTimeout(checkIos, 300); setTimeout(checkIos, 1500);
    try { window.addEventListener("resize", checkIos); window.addEventListener("orientationchange", () => setTimeout(checkIos, 300)); } catch { /* ignore */ }
  }

  // v336: live update (@capgo/capacitor-updater) — tell it this web build started fine, otherwise it rolls back to the
  // previous one after a few seconds (a broken update can never brick the app).
  try { plugin("CapacitorUpdater")?.notifyAppReady?.(); } catch { /* plugin not in this build */ }
  // v337: the live-update check follows this build's server address. The address inside the App Store build
  // (capacitor.config.json) can't change without a release, so when a live update moves to a new domain the app
  // switches its update check there too (needs allowModifyUrl + persistModifyUrl in the config — set since v337).
  try {
    const U = plugin("CapacitorUpdater");
    // v364: the Android app (android-app/) asks its own route, so iPhone and Android updates can be paused separately.
    const route = nativePlatform() === "android" ? "android-update" : "ios-update";
    if (U?.setUpdateUrl) Promise.resolve(U.setUpdateUrl({ url: `${API_ORIGIN}/api/app/${route}` })).catch(() => {});
  } catch { /* older plugin */ }

  // fetch("/api/…") → live server, with the same Bearer token axios sends.
  try {
    const orig = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      try {
        if (typeof input === "string" && /^\/(api|uploads)(\/|\?|$)/.test(input)) {
          const headers = new Headers(init.headers || {});
          const t = window.localStorage.getItem("ybex_token");
          if (t && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${t}`);
          return orig(activeOrigin + input, { ...init, headers }); // v467: main or backup, whichever is in use
        }
      } catch { /* fall through */ }
      return orig(input, init);
    };
  } catch { /* ignore */ }

  // Pictures / videos / file links the server hands out as "/api/files/…" or "/uploads/…" would point at the
  // phone (capacitor://localhost) — rewrite them to the live server as they appear on screen.
  try {
    const ATTRS = ["src", "href", "poster"];
    const fix = (el) => {
      if (!el || el.nodeType !== 1) return;
      for (const a of ATTRS) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v && /^\/(api|uploads)\//.test(v)) el.setAttribute(a, activeOrigin + v); // v467: follows the backup switch
      }
    };
    const scan = (root) => {
      fix(root);
      if (root.querySelectorAll) root.querySelectorAll("img[src^='/api/'],img[src^='/uploads/'],video[src^='/api/'],video[poster^='/api/'],source[src^='/api/'],a[href^='/api/'],a[href^='/uploads/']").forEach(fix);
    };
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") fix(m.target);
        else m.addedNodes && m.addedNodes.forEach((n) => scan(n));
      }
    });
    const start = () => { scan(document.body); mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS }); };
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
  } catch { /* ignore */ }

  const App = plugin("App");
  const Browser = plugin("Browser");
  try {
    App?.addListener?.("appUrlOpen", (ev) => {
      const url = String(ev?.url || "");
      if (!url.startsWith(`${APP_SCHEME}://`)) return;
      try { Browser?.close?.(); } catch { /* not open */ }
      const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
      const path = url.replace(`${APP_SCHEME}://`, "").split(/[?#]/)[0] || "";
      // v446: keep the query (com.ybex.app://app?role=brand opens the brand sign-up); OAuth links stay as they were
      const query = path.startsWith("oauth") ? "" : deepLinkQuery(url);
      const target = path.startsWith("oauth") ? `/app/oauth${hash}` : `/${path}${query}${hash}`;
      window.history.pushState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    // v364 (Android app, Ravi: "app crash hota hai, UX sahi nahi"): the phone's Back button never traps anyone.
    // Home screens / login → app goes to the background (like every Android app). Elsewhere → one step back; if that
    // step didn't change the page (nothing to go back to, or a screen that bounces straight back), background too.
    App?.addListener?.("backButton", ({ canGoBack }) => {
      const leave = () => { try { if (App?.minimizeApp) App.minimizeApp(); else App?.exitApp?.(); } catch { /* ignore */ } };
      // v426: an open sheet / step owns the top history entry — Back just closes it, never backgrounds the app.
      const st = window.history.state || {};
      // v456 (Back review): Eva, the app tour and onboarding steps also own the top entry — Back closes / steps them
      // back. On Home with Eva open, Back used to close the whole app; elsewhere Eva closed and then the app too.
      if (isAppEntry(st)) { window.history.back(); return; }
      // v456: Razorpay checkout / any other popup still on screen (no history entry of its own) → close it, stay put
      if (closeTopPopup(document)) return;
      if (isRootPath(window.location.pathname)) return leave();
      if (!(canGoBack || window.history.length > 1)) return leave();
      // v456: no more "URL didn't change → close the app" — a same-URL step / sheet entry is a normal Back, not a reason to quit
      window.history.back();
    });
  } catch { /* ignore */ }
}


// ── v418: Meta app events (Facebook SDK, native plugin "MetaEvents" in android-overrides) ─────────────────────────
// The Android app logs installs / app opens by itself (SDK auto events). Ybex's own funnel events go through here.
// Standard names map to the SDK's names; custom ones (QualifiedCreator, QualifiedCreator10K) are sent as they are.
const META_SDK_NAMES = { CompleteRegistration: "fb_mobile_complete_registration" };
let metaPlugin;
function metaEvents() {
  if (metaPlugin !== undefined) return metaPlugin;
  try {
    const C = window.Capacitor;
    metaPlugin = (C?.Plugins?.MetaEvents) || (typeof C?.registerPlugin === "function" ? C.registerPlugin("MetaEvents") : null);
  } catch { metaPlugin = null; }
  return metaPlugin;
}
/** True inside the Android app build that carries the Meta SDK. */
export function hasMetaSdk() {
  return isNative() && nativePlatform() === "android" && Boolean(metaEvents());
}
/** Send one event to the Meta SDK. `eventId` = the same id the server's Conversions API copy uses (Meta counts it once). */
export function logMetaAppEvent(name, params = {}, eventId = "") {
  try {
    const P = metaEvents();
    if (!P || !isNative()) return false;
    const clean = {};
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && k !== "value") clean[k] = typeof v === "number" ? v : String(v);
    if (eventId) clean.event_id = String(eventId);
    const value = Number(params?.value);
    P.logEvent({ name: META_SDK_NAMES[name] || name, params: clean, ...(Number.isFinite(value) ? { value } : {}) })?.catch?.(() => {});
    return true;
  } catch { return false; }
}
/** Google Play install referrer, e.g. "utm_source=meta&utm_campaign=diwali" (first open only; "" when none). */
export async function readInstallReferrer() {
  try {
    const P = metaEvents();
    if (!P || nativePlatform() !== "android" || typeof P.getInstallReferrer !== "function") return "";
    const r = await P.getInstallReferrer();
    return String(r?.referrer || "");
  } catch { return ""; }
}
