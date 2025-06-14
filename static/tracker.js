// static/tracker.js

let mousePath = [];
let clickPositions = [];
let totalClicks = 0;
let adClicks = 0;
let clickStartTime = performance.now();
let hoverTimers = {};
let hoverDurations = {};
let sessionStart = Date.now();

// Capture mouse path with timestamp
document.addEventListener("mousemove", (e) => {
    const time = performance.now() - clickStartTime;
    mousePath.push([e.clientX, e.clientY, time.toFixed(2)]);
});

// Track max scroll depth
let maxScrollY = 0;
window.addEventListener("scroll", () => {
    maxScrollY = Math.max(maxScrollY, window.scrollY);
});

// Click tracking
document.addEventListener("click", (e) => {
    totalClicks++;
    clickPositions.push([e.clientX, e.clientY]);

    // Delay from page load to first click
    if (!window.clickDelay) {
        const delay = (performance.now() - clickStartTime) / 1000;
        window.clickDelay = delay.toFixed(2);
    }

    // Track if ad banner was clicked
    if (e.target.closest("#ad_banner")) {
        adClicks++;
    }
});

// Hover time tracking
const trackHover = (element) => {
    element.addEventListener("mouseenter", () => {
        hoverTimers[element.id] = Date.now();
    });

    element.addEventListener("mouseleave", () => {
        if (hoverTimers[element.id]) {
            const duration = (Date.now() - hoverTimers[element.id]) / 1000;
            hoverDurations[element.id] = (hoverDurations[element.id] || 0) + duration;
            delete hoverTimers[element.id];
        }
    });
};

// Attach hover listeners
window.addEventListener("load", () => {
    document.querySelectorAll(".product, .category, #ad_banner").forEach(trackHover);
});

// Extract fingerprint features
function getFingerprint() {
    let canvas = document.createElement("canvas");
    let gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    let debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    return {
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        user_agent: navigator.userAgent,
        webgl_vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "unknown",
        webgl_renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown",
        touch_support: 'ontouchstart' in window,
        plugins: Array.from(navigator.plugins).map(p => p.name)
    };
}

// Send session data before leaving
window.addEventListener("beforeunload", () => {
    const payload = {
        session_id: crypto.randomUUID(),
        label: "human",
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        mouse_path: mousePath,
        scroll_depth: maxScrollY,
        click_delay: window.clickDelay || null,
        click_positions: clickPositions,
        total_clicks: totalClicks,
        ad_clicks: adClicks,
        hover_times: hoverDurations,
        session_duration: ((Date.now() - sessionStart) / 1000).toFixed(2),
        fingerprint: getFingerprint()
    };

    navigator.sendBeacon("/log_session", JSON.stringify(payload));
});
