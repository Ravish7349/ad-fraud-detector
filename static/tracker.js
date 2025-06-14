// static/tracker.js

let mousePath = [];
let clickPositions = [];
let totalClicks = 0;
let adClicks = 0;
let clickStartTime = performance.now();
let hoverTimers = {};
let hoverDurations = {};
let sessionStart = Date.now();

// 📌 Mouse movement tracking
document.addEventListener("mousemove", (e) => {
    const time = performance.now() - clickStartTime;
    mousePath.push([e.clientX, e.clientY, time.toFixed(2)]);
});

// 📌 Scroll tracking
let maxScrollY = 0;
window.addEventListener("scroll", () => {
    maxScrollY = Math.max(maxScrollY, window.scrollY);
});

// 📌 Click tracking
document.addEventListener("click", (e) => {
    totalClicks++;
    clickPositions.push([e.clientX, e.clientY]);

    if (!window.clickDelay) {
        const delay = (performance.now() - clickStartTime) / 1000;
        window.clickDelay = delay.toFixed(2);
    }

    if (e.target.closest("#ad_banner")) {
        adClicks++;
    }
});

// 📌 Hover duration tracking
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

// 📌 Attach hover tracking to products, categories, and ad
window.addEventListener("load", () => {
    document.querySelectorAll(".product, .category, #ad_banner").forEach(trackHover);
});

// 📌 Device fingerprinting
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

// 📌 Send data using fetch() before user leaves
window.addEventListener("beforeunload", async () => {
    const payload = {
        session_id: crypto.randomUUID(),
        label: "human",
        timestamp: new Date().toISOString(),
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

    try {
        await fetch("/log_session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            keepalive: true // 🔐 Ensures delivery on unload
        });
    } catch (error) {
        console.error("Session logging failed:", error);
    }
});
