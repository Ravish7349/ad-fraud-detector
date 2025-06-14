# backend/db.py
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            label TEXT,
            timestamp TIMESTAMP,
            mouse_path JSONB,
            scroll_depth INTEGER,
            click_delay FLOAT,
            click_positions JSONB,
            total_clicks INTEGER,
            hover_times JSONB,
            session_duration FLOAT,
            fingerprint JSONB
        );
    """)

    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    init_db()
