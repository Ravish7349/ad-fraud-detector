from flask import Flask, render_template, request, jsonify
from db import get_connection, init_db
import json
from datetime import datetime
import os
import sys
import traceback
from pytz import timezone, UTC
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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/log_session', methods=['POST'])
def log_session():
    try:
        data = request.get_json(force=True)

        session_id = data.get("session_id")
        label = data.get("label", "unknown")

        # --- Convert incoming timestamp to IST ---
        # Accept "timestamp" (ISO string) or fallback to now()
        timestamp_str = data.get("timestamp") or data.get("wall_time_iso")
        try:
            dt_utc = parser.isoparse(timestamp_str) if timestamp_str else datetime.utcnow()
        except Exception:
            dt_utc = datetime.utcnow()
        # Ensure tz-aware UTC
        if dt_utc.tzinfo is None:
            dt_utc = UTC.localize(dt_utc)

        # To IST
        dt_ist = dt_utc.astimezone(timezone("Asia/Kolkata"))

        # 1) Store IST as naive TIMESTAMP (keeps your original schema)
        timestamp = dt_ist.replace(tzinfo=None)

        # 2) Also store IST formatted display string "DD-MM-YYYY HH:MM"
        wall_time_local = dt_ist.strftime("%d-%m-%Y %H:%M")

        # --- Standard features ---
        mouse_path       = json.dumps(data.get("mouse_path"))
        scroll_depth     = int(data.get("scroll_depth") or 0)
        click_delay      = float(data.get("click_delay") or 0)
        click_positions  = json.dumps(data.get("click_positions"))
        total_clicks     = int(data.get("total_clicks") or 0)
        ad_clicks        = int(data.get("ad_clicks") or 0)
        hover_times      = json.dumps(data.get("hover_times"))
        session_duration = float(data.get("session_duration") or 0)
        fingerprint      = json.dumps(data.get("fingerprint"))

        # --- Ad-focused features ---
        ad_hover_time         = float(data.get("ad_hover_time") or 0)
        ad_visible_time       = float(data.get("ad_visible_time") or 0)
        ad_click_coordinates  = json.dumps(data.get("ad_click_coordinates") or [])  # ensure list not dict
        ad_visibility_changes = json.dumps(data.get("ad_visibility_changes") or [])
        ad_dwell_time         = float(data.get("ad_dwell_time") or 0)
        ad_click_accuracy     = float(data.get("ad_click_accuracy") or 0)
        repeated_ad_clicks    = int(data.get("repeated_ad_clicks") or 0)
        scroll_to_ad_time     = float(data.get("scroll_to_ad_time") or 0)

        # Insert into database (note: wall_time_local added right after timestamp)
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
            VALUES (%s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s)
        """, (
            session_id, label, timestamp, wall_time_local,
            mouse_path, scroll_depth, click_delay,
            click_positions, total_clicks, ad_clicks, hover_times, session_duration,
            fingerprint, ad_hover_time, ad_visible_time, ad_click_coordinates,
            ad_visibility_changes, ad_dwell_time, ad_click_accuracy, repeated_ad_clicks,
            scroll_to_ad_time
        ))
        conn.commit()
        cur.close()
        conn.close()

        return "Session logged successfully", 200

    except Exception as e:
        print("[ERROR]", e, file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"ok": False, "error": "Error logging session"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
