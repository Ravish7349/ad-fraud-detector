from flask import Flask, render_template, request, jsonify
from db import get_connection, init_db
import json
from datetime import datetime, timezone as dt_tz
import os
import sys
import traceback
import pytz
from dateutil import parser

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "../templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "../static")
)

# Ensure table exists at startup (safe no-op if already created)
try:
    init_db()
except Exception as e:
    print("[WARN] init_db failed:", e, file=sys.stderr)

IST = pytz.timezone("Asia/Calcutta")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/log_session', methods=['POST'])
def log_session():
    try:
        data = request.get_json(force=True)

        # Expect UTC ISO from client; fallback to now-UTC; treat naive as UTC
        ts_raw = data.get("timestamp")
        try:
            dt = parser.isoparse(ts_raw) if ts_raw else datetime.now(dt_tz.utc)
        except Exception:
            dt = datetime.now(dt_tz.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_tz.utc)

        # Human-readable IST wall clock
        wall_time_local = dt.astimezone(IST).strftime("%d-%m-%Y %H:%M")

        row = {
            "session_id": data.get("session_id"),
            "label": data.get("label", "unknown"),
            "timestamp": dt,  # TIMESTAMPTZ (UTC)
            "wall_time_local": wall_time_local,

            "mouse_path": json.dumps(data.get("mouse_path")),
            "scroll_depth": _safe_int(data.get("scroll_depth")),
            "click_delay": _nullable_float(data.get("click_delay")),
            "click_positions": json.dumps(data.get("click_positions")),
            "total_clicks": _safe_int(data.get("total_clicks")),
            "ad_clicks": _safe_int(data.get("ad_clicks")),
            "hover_times": json.dumps(data.get("hover_times")),
            "session_duration": _nullable_float(data.get("session_duration")),
            "fingerprint": json.dumps(data.get("fingerprint")),

            "ad_hover_time": _nullable_float(data.get("ad_hover_time")),
            "ad_visible_time": _nullable_float(data.get("ad_visible_time")),
            "ad_click_coordinates": json.dumps(data.get("ad_click_coordinates") or []),
            "ad_visibility_changes": json.dumps(data.get("ad_visibility_changes") or []),
            "ad_dwell_time": _nullable_float(data.get("ad_dwell_time")),      # already frozen on client
            "ad_click_accuracy": _nullable_float(data.get("ad_click_accuracy")),
            "repeated_ad_clicks": _safe_int(data.get("repeated_ad_clicks")),
            "scroll_to_ad_time": _nullable_float(data.get("scroll_to_ad_time")),
        }

        # Enforce semantics: if no ad clicks, dwell/accuracy must be NULL
        if (row["ad_clicks"] or 0) == 0:
            row["ad_dwell_time"] = None
            row["ad_click_accuracy"] = None

        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sessions (
                session_id, label, timestamp, wall_time_local,
                mouse_path, scroll_depth, click_delay,
                click_positions, total_clicks, ad_clicks, hover_times, session_duration,
                fingerprint, ad_hover_time, ad_visible_time, ad_click_coordinates,
                ad_visibility_changes, ad_dwell_time, ad_click_accuracy, repeated_ad_clicks,
                scroll_to_ad_time
            )
            VALUES (%(session_id)s, %(label)s, %(timestamp)s, %(wall_time_local)s,
                    %(mouse_path)s, %(scroll_depth)s, %(click_delay)s,
                    %(click_positions)s, %(total_clicks)s, %(ad_clicks)s, %(hover_times)s, %(session_duration)s,
                    %(fingerprint)s, %(ad_hover_time)s, %(ad_visible_time)s, %(ad_click_coordinates)s,
                    %(ad_visibility_changes)s, %(ad_dwell_time)s, %(ad_click_accuracy)s, %(repeated_ad_clicks)s,
                    %(scroll_to_ad_time)s)
            ON CONFLICT (session_id) DO NOTHING;
        """, row)
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True}), 200

    except Exception as e:
        print("[ERROR]", e, file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"ok": False, "error": "Error logging session"}), 500


def _safe_int(x):
    try:
        return int(x) if x is not None else None
    except Exception:
        return None

def _nullable_float(x):
    if x is None:
        return None
    try:
        return float(x)
    except Exception:
        return None


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
