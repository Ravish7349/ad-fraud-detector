# backend/app.py
from flask import Flask, render_template, request
from db import get_connection
import json
from datetime import datetime
import os

app = Flask(__name__, template_folder="../templates", static_folder="../static")

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/log_session', methods=['POST'])
def log_session():
    try:
        # Parse JSON payload
        data = request.get_json(force=True)

        # Extract values
        session_id = data.get("session_id")
        label = data.get("label", "unknown")
        timestamp = data.get("timestamp")
        mouse_path = json.dumps(data.get("mouse_path"))
        scroll_depth = data.get("scroll_depth")
        click_delay = float(data.get("click_delay") or 0)
        click_positions = json.dumps(data.get("click_positions"))
        total_clicks = int(data.get("total_clicks") or 0)
        ad_clicks = int(data.get("ad_clicks") or 0)
        hover_times = json.dumps(data.get("hover_times"))
        session_duration = float(data.get("session_duration") or 0)
        fingerprint = json.dumps(data.get("fingerprint"))

        # Insert into DB
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (
                session_id, label, timestamp, mouse_path, scroll_depth, click_delay,
                click_positions, total_clicks, ad_clicks, hover_times, session_duration, fingerprint
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
                session_id, label, timestamp, mouse_path, scroll_depth, click_delay,
                click_positions, total_clicks, ad_clicks, hover_times, session_duration, fingerprint
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return "Session logged", 200

    except Exception as e:
        print(f"[ERROR] {e}")
        return "Error logging session", 500


if __name__ == '__main__':
    app.run(debug=True)
