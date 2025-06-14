// static/tracker.js

let mousePath = [];
let clickPositions = [];
let totalClicks = 0;
let adClicks = 0;
let repeatedAdClicks = 0;
let clickStartTime = performance.now();
let hoverTimers = {};
let hoverDurations = {};
let sessionStart = Date.now();

// ✅ New ad metrics
let adHoverStart = null;
let adHoverTime = 0;
let adVisibleTime = 0;
let adVisibilityChanges = [];
let adClickCoordinates = [];
let adDwellTime = null;
let adClickAccuracy = null;
let scrollToAdTime = null;
let adSeenAt = null;

// 📌 Mouse movement tracking
document.addEventListener("mousemove", (e) => {
    const time = performance.now() - clickStartTime;
    mousePath.push([e.clientX, e.clientY, time.toFixed(2)]);
});

// 📌 Scroll tracking
let maxScrollY = 0;
window.addEventListener("scroll", () => {
    maxScrollY = Math.max(maxScrollY, window.scrollY);
    if (!scrollToAdTime) {
        const ad = document.getElementById("ad_banner");
        const rect = ad.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            scrollToAdTime = ((Date.now() - sessionStart) / 1000).toFixed(2);
            adSeenAt = Date.now();
        }
    }
});

// 📌 Ad hover tracking
const adBanner = document.getElementById("ad_banner");
adBanner.addEventListener("mouseenter", () => {
    adHoverStart = Date.now();
});
adBanner.addEventListener("mouseleave", () => {
    if (adHoverStart) {
        adHoverTime += (Date.now() - adHoverStart) / 1000;
        adHoverStart = null;
    }
});

// 📌 Visibility tracking with IntersectionObserver
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const ts = Date.now();
        adVisibilityChanges.push({ time: ts, ratio: entry.intersectionRatio });
        if (entry.isIntersecting && entry.intersectionRatio === 1.0) {
            const start = ts;
            const visibleInterval = setInterval(() => {
                if (!entry.isIntersecting || entry.intersectionRatio < 1.0) {
                    clearInterval(visibleInterval);
                } else {
                    adVisibleTime += 0.1; // granularity ~100ms
                }
            }, 100);
        }
    });
}, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });
observer.observe(adBanner);

// 📌 Click tracking
const adImage = document.getElementById("ad_image");
document.addEventListener("click", (e) => {
    totalClicks++;
    clickPositions.push([e.clientX, e.clientY]);

    if (!window.clickDelay) {
        const delay = (performance.now() - clickStartTime) / 1000;
        window.clickDelay = delay.toFixed(2);
    }

    if (e.target.closest("#ad_banner")) {
        adClicks++;
        repeatedAdClicks++;

        // Dwell time: hover → click
        if (adSeenAt) {
            adDwellTime = ((Date.now() - adSeenAt) / 1000).toFixed(2);
        }

        // Click coordinates
        const adRect = adImage.getBoundingClientRect();
        const clickX = e.clientX;
        const clickY = e.clientY;
        adClickCoordinates.push({ x: clickX, y: clickY });

        // Accuracy: distance from center
        const centerX = adRect.left + adRect.width / 2;
        const centerY = adRect.top + adRect.height / 2;
        const dx = clickX - centerX;
        const dy = clickY - centerY;
        adClickAccuracy = Math.sqrt(dx * dx + dy * dy).toFixed(2);
    }
});

// 📌 Hover duration for all trackable elements
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

window.addEventListener("load", () => {
    document.querySelectorAll(".product, .category, #ad_banner").forEach(trackHover);
});

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

// 📌 Final Payload
window.addEventListener("beforeunload", async () => {
    const payload = {
        session_id: crypto.randomUUID(),
        label: "human",
        timestamp: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }),
        mouse_path: mousePath,
        scroll_depth: maxScrollY,
        click_delay: window.clickDelay || null,
        click_positions: clickPositions,
        total_clicks: totalClicks,
        ad_clicks: adClicks,
        repeated_ad_clicks: repeatedAdClicks,
        ad_hover_time: parseFloat(adHoverTime.toFixed(2)),
        ad_visible_time: parseFloat(adVisibleTime.toFixed(2)),
        ad_click_coordinates: adClickCoordinates,
        ad_visibility_changes: adVisibilityChanges,
        ad_dwell_time: parseFloat(adDwellTime || 0),
        ad_click_accuracy: parseFloat(adClickAccuracy || 0),
        scroll_to_ad_time: parseFloat(scrollToAdTime || 0),
        hover_times: hoverDurations,
        session_duration: parseFloat(((Date.now() - sessionStart) / 1000).toFixed(2)),
        fingerprint: getFingerprint()
    };

    try {
        await fetch("/log_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true
        });
    } catch (error) {
        console.error("Session logging failed:", error);
    }
});
