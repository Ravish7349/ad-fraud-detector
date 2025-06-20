from flask import Flask, render_template, request
from db import get_connection
import json
from datetime import datetime
import os
import sys
import traceback
from pytz import timezone
from dateutil import parser


# Set correct paths for production and local
app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "../templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "../static")
)

@app.route('/')
def index():
    return render_template('index.html')

from pytz import timezone
from dateutil import parser

@app.route('/log_session', methods=['POST'])
def log_session():
    try:
        data = request.get_json(force=True)

        session_id = data.get("session_id")
        label = data.get("label", "unknown")
        timestamp_str = data.get("timestamp")

        # Convert ISO timestamp to IST
        utc_time = parser.isoparse(timestamp_str)
        ist = timezone("Asia/Kolkata")
        timestamp = utc_time.astimezone(ist)

        # Standard features
        mouse_path = json.dumps(data.get("mouse_path"))
        scroll_depth = int(data.get("scroll_depth") or 0)
        click_delay = float(data.get("click_delay") or 0)
        click_positions = json.dumps(data.get("click_positions"))
        total_clicks = int(data.get("total_clicks") or 0)
        ad_clicks = int(data.get("ad_clicks") or 0)
        hover_times = json.dumps(data.get("hover_times"))
        session_duration = float(data.get("session_duration") or 0)
        fingerprint = json.dumps(data.get("fingerprint"))

        # New ad-focused features
        ad_hover_time = float(data.get("ad_hover_time") or 0)
        ad_visible_time = float(data.get("ad_visible_time") or 0)
        ad_click_coordinates = json.dumps(data.get("ad_click_coordinates") or {})
        ad_visibility_changes = json.dumps(data.get("ad_visibility_changes") or [])
        ad_dwell_time = float(data.get("ad_dwell_time") or 0)
        ad_click_accuracy = float(data.get("ad_click_accuracy") or 0)
        repeated_ad_clicks = int(data.get("repeated_ad_clicks") or 0)
        scroll_to_ad_time = float(data.get("scroll_to_ad_time") or 0)

        # Insert into database
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (
                session_id, label, timestamp, mouse_path, scroll_depth, click_delay,
                click_positions, total_clicks, ad_clicks, hover_times, session_duration,
                fingerprint, ad_hover_time, ad_visible_time, ad_click_coordinates,
                ad_visibility_changes, ad_dwell_time, ad_click_accuracy, repeated_ad_clicks,
                scroll_to_ad_time
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            session_id, label, timestamp, mouse_path, scroll_depth, click_delay,
            click_positions, total_clicks, ad_clicks, hover_times, session_duration,
            fingerprint, ad_hover_time, ad_visible_time, ad_click_coordinates,
            ad_visibility_changes, ad_dwell_time, ad_click_accuracy, repeated_ad_clicks,
            scroll_to_ad_time
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return "Session logged successfully", 200

    except Exception as e:
        print("[ERROR]", e, file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return "Error logging session", 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
