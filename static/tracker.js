// static/tracker.js

// ====== Time base: SECONDS since tracker start (performance.now() - sessionStart)/1000 ======
let sessionStart = performance.now();      // ms
let firstClickAt = null;                   // ms (for click_delay)
let scrollToastShown = false;
let adInViewToastShown = false;

// Mouse path: [x, y, t_seconds]
const mousePath = [];
document.addEventListener("mousemove", (e) => {
  const tSec = Number(((performance.now() - sessionStart) / 1000).toFixed(2));
  mousePath.push([e.clientX, e.clientY, tSec]);
});

// Scroll depth (px)
let maxScrollY = 0;
window.addEventListener("scroll", () => {
  const y = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0);
  maxScrollY = Math.max(maxScrollY, y);

  if (!scrollToastShown) {
    toast("Scroll detected");
    scrollToastShown = true;
  }
});

// Clicks (total + ad), positions, accuracy
let totalClicks = 0;
let adClicks = 0;
const clickPositions = [];
const adClickCoordinates = [];
let adClickAccuracy = null;                // px (distance to ad center)

// Hover tracking (seconds per element)
const hoverTimers = {};                    // id -> start ms
const hoverDurations = {};                 // id -> seconds
function startHover(id) { hoverTimers[id] = performance.now(); }
function endHover(id) {
  const t0 = hoverTimers[id];
  if (t0 != null) {
    const sec = (performance.now() - t0) / 1000;
    hoverDurations[id] = (hoverDurations[id] || 0) + sec;
    delete hoverTimers[id];
  }
}
// Generic per-element hover tracking (uses element.id or the selector text)
function attachHoverTracking(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    const id = el.id || selector;
    el.addEventListener("mouseenter", () => startHover(id));
    el.addEventListener("mouseleave", () => endHover(id));
  });
}
// SPECIAL: aggregate a selector’s hover time under the EMPTY KEY "" (so ".category" never appears)
function attachAggregateHoverTracking(selector, aggregateKey = "") {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener("mouseenter", () => startHover(aggregateKey));
    el.addEventListener("mouseleave", () => endHover(aggregateKey));
  });
}

// Toasts (UI-only; no backend impact)
function ensureToastStyles() {
  if (document.getElementById("toast-styles")) return;
  const style = document.createElement("style");
  style.id = "toast-styles";
  style.textContent = `
    .toast-stack{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:9999}
    .toast{min-width:220px;max-width:360px;padding:12px 14px;border-radius:12px;background:#111;color:#fff;
           box-shadow:0 8px 24px rgba(0,0,0,.18);font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
           opacity:0;transform:translateY(8px);transition:opacity .18s ease, transform .18s ease}
    .toast.show{opacity:1;transform:translateY(0)}
  `;
  document.head.appendChild(style);
}
let toastStack;
function toast(msg, timeout = 1800) {
  ensureToastStyles();
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.appendChild(toastStack);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastStack.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 200);
  }, timeout);
}

window.addEventListener("DOMContentLoaded", () => {
  // Track product hovers individually (expects ids like product_1, product_2, ...)
  attachHoverTracking(".product");
  // Aggregate ALL category hovers under "" (not ".category")
  attachAggregateHoverTracking(".category", "");

  // Ad hover
  const ad = document.getElementById("ad_banner");
  if (ad) {
    ad.addEventListener("mouseenter", () => startHover("ad_banner"));
    ad.addEventListener("mouseleave", () => endHover("ad_banner"));
  }
});

// ====== Ad visibility tracking (IntersectionObserver) ======
let adVisibleTime = 0;                     // seconds of full visibility
let adVisibilityChanges = [];              // [{ time (sec since tracker start), ratio }]
let lastFullVisibleAt = null;              // ms marker when full visibility started
let scroll_to_ad_time = null;              // seconds to first full view
let adSeenAt = null;                       // seconds (first full view time)

// Dwell computed ON FIRST AD CLICK ONLY (frozen)
let adFirstClickAtSec = null;
let adDwellTimeSec = null;

const adEl = document.getElementById("ad_banner");
if (adEl) {
  const io = new IntersectionObserver((entries) => {
    const now = performance.now();
    for (const entry of entries) {
      // Log timeline in SECONDS since tracker start
      adVisibilityChanges.push({
        time: Number(((now - sessionStart) / 1000).toFixed(2)),
        ratio: Number(entry.intersectionRatio.toFixed(2)),
      });

      if (entry.intersectionRatio === 1.0) {
        if (scroll_to_ad_time == null) {
          scroll_to_ad_time = Number(((now - sessionStart) / 1000).toFixed(2));
        }
        if (adSeenAt == null) {
          adSeenAt = Number(((now - sessionStart) / 1000).toFixed(2));
        }
        if (lastFullVisibleAt == null) lastFullVisibleAt = now;

        if (!adInViewToastShown) {
          toast("Ad fully visible");
          adInViewToastShown = true;
        }
      } else {
        // Leaving full visibility → accumulate
        if (lastFullVisibleAt != null) {
          adVisibleTime += (now - lastFullVisibleAt) / 1000;
          lastFullVisibleAt = null;
        }
      }
    }
  }, { threshold: [0, 1.0] });
  io.observe(adEl);
}

// ====== Click handling (also drives toasts so it works for dynamic elements) ======
document.addEventListener("click", (e) => {
  totalClicks += 1;
  clickPositions.push([e.clientX, e.clientY]);

  if (firstClickAt == null) firstClickAt = performance.now();

  // Product click toast (delegated, works for dynamic DOM)
  const productEl = e.target.closest?.(".product");
  if (productEl) {
    const label = productEl.id || productEl.textContent.trim() || "Product";
    toast(`${label} clicked`);
  }

  // Ad click handling + toast
  if (adEl) {
    const rect = adEl.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top  && e.clientY <= rect.bottom;

    if (inside) {
      toast("Ad clicked");
      // Count ad click & coordinates
      adClicks += 1;
      adClickCoordinates.push({ x: e.clientX, y: e.clientY });

      // Accuracy (distance to ad center, px)
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      adClickAccuracy = Number(dist.toFixed(2));

      // Freeze dwell time at FIRST ad click only
      if (adFirstClickAtSec == null) {
        adFirstClickAtSec = Number(((performance.now() - sessionStart) / 1000).toFixed(2));
        if (typeof adSeenAt === "number") {
          adDwellTimeSec = Number((adFirstClickAtSec - adSeenAt).toFixed(2));
        }
      }
    }
  }
});

// ====== Helpers ======
function getClickDelaySec() {
  if (firstClickAt == null) return null;
  return Number(((firstClickAt - sessionStart) / 1000).toFixed(2));
}
function getSessionDurationSec() {
  return Number(((performance.now() - sessionStart) / 1000).toFixed(2));
}
function getFingerprint() {
  // WebGL vendor/renderer (best-effort)
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
  const webgl_vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : "unknown";
  const webgl_renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown";

  // Canonical plugin ordering (deduped, only those that exist)
  const wantOrder = [
    "PDF Viewer",
    "Chrome PDF Viewer",
    "Chromium PDF Viewer",
    "Microsoft Edge PDF Viewer",
    "WebKit built-in PDF",
  ];
  const have = new Set(Array.from(navigator.plugins || []).map(p => p.name));
  const plugins = wantOrder.filter(name => have.has(name));

  // Timezone with robust fallback (keep legacy "Asia/Calcutta")
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  if (!timezone || timezone === "UTC") {
    const minutes = -new Date().getTimezoneOffset();
    if (minutes === 330) timezone = "Asia/Calcutta"; // legacy label to match historical data
    else timezone = timezone || "UTC";
  }

  return {
    plugins,
    timezone,
    user_agent: navigator.userAgent,
    webgl_vendor,
    touch_support: ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0,
    webgl_renderer,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
  };
}

// ====== Send on unload ======
window.addEventListener("beforeunload", () => {
  // Close any ongoing full-visibility period
  if (lastFullVisibleAt != null) {
    adVisibleTime += (performance.now() - lastFullVisibleAt) / 1000;
    lastFullVisibleAt = null;
  }
  // Close active hovers
  Object.keys(hoverTimers).forEach(endHover);

  // SERVER-SIDE GUARD also enforces no ".category" key; client already aggregates to "".
  const payload = {
    session_id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()),
    label: "human",
    timestamp: new Date().toISOString(),      // UTC ISO

    // Core interaction
    mouse_path: mousePath,                     // t in SECONDS (since tracker start)
    scroll_depth: maxScrollY,
    click_delay: getClickDelaySec(),
    click_positions: clickPositions,
    total_clicks: totalClicks,
    ad_clicks: adClicks,
    hover_times: Object.fromEntries(
      Object.entries(hoverDurations).map(([k, v]) => [k, Number(v.toFixed(2))])
    ),
    session_duration: getSessionDurationSec(),
    fingerprint: getFingerprint(),

    // Ad-focused
    ad_hover_time: Number((hoverDurations["ad_banner"] || 0).toFixed(2)),
    ad_visible_time: Number(adVisibleTime.toFixed(2)),
    ad_click_coordinates: adClickCoordinates,
    ad_visibility_changes: adVisibilityChanges,    // time in SECONDS (since tracker start)

    // Fixed semantics
    repeated_ad_clicks: Math.max(0, adClicks - 1),
    ad_dwell_time: (adClicks > 0 && adDwellTimeSec != null) ? adDwellTimeSec : null,
    ad_click_accuracy: (adClicks > 0) ? adClickAccuracy : null,
    scroll_to_ad_time: (typeof scroll_to_ad_time === "number") ? scroll_to_ad_time : null,
  };

  navigator.sendBeacon("/log_session", new Blob([JSON.stringify(payload)], { type: "application/json" }));
});
