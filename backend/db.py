# backend/db.py
import psycopg2
import os
from dotenv import load_dotenv, find_dotenv
from pathlib import Path

# Load .env locally; on Render, env vars are injected by the platform
env_path = Path(__file__).with_name(".env")
if not load_dotenv(dotenv_path=env_path):
    load_dotenv(find_dotenv())

def get_connection():
    """
    Connect to Postgres using either:
      - DATABASE_URL   (recommended on Render; often includes ?sslmode=require)
      - or discrete DB_* env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
    """
    url = os.getenv("DATABASE_URL")
    if url:
        return psycopg2.connect(url)

    params = dict(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    sslmode = os.getenv("DB_SSLMODE")
    if sslmode:
        params["sslmode"] = sslmode

    # basic sanity to avoid silent failures
    if not params["dbname"] or not params["user"]:
        raise RuntimeError("Missing DB config. Set DATABASE_URL or DB_* vars.")

    return psycopg2.connect(**params)

def init_db():
    """
    Create the sessions table if it doesn't exist.
    Also adds wall_time_local if the table predates that column.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Full table definition (includes wall_time_local)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        label TEXT,
        timestamp TIMESTAMP,          -- IST (naive) stored by app
        wall_time_local TEXT,         -- "DD-MM-YYYY HH:MM" (IST display string)

        mouse_path JSONB,
        scroll_depth INTEGER,
        click_delay FLOAT,
        click_positions JSONB,
        total_clicks INTEGER,
        ad_clicks INTEGER,
        hover_times JSONB,
        session_duration FLOAT,
        fingerprint JSONB,

        ad_hover_time FLOAT,
        ad_visible_time FLOAT,
        ad_click_coordinates JSONB,
        ad_visibility_changes JSONB,
        ad_dwell_time FLOAT,
        ad_click_accuracy FLOAT,
        repeated_ad_clicks INTEGER,
        scroll_to_ad_time FLOAT
    );
    """)

    # Backfill column if table already existed without wall_time_local
    cursor.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='sessions' AND column_name='wall_time_local'
        ) THEN
            ALTER TABLE sessions ADD COLUMN wall_time_local TEXT;
        END IF;
    END$$;
    """)

    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    # Create/upgrade schema and quick connection check
    init_db()
    conn = get_connection()
    print("DB OK:", conn.get_dsn_parameters())
    conn.close()
