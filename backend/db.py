# backend/db.py
import psycopg2
import os
from dotenv import load_dotenv, find_dotenv
from pathlib import Path

# Load .env locally; in hosted envs, vars come from the platform
env_path = Path(__file__).with_name(".env")
if not load_dotenv(dotenv_path=env_path):
    load_dotenv(find_dotenv())
    

def get_connection():
    """
    Connect to Postgres using either:
      - DATABASE_URL (preferred)
      - or DB_* env vars
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

    if not params["dbname"] or not params["user"]:
        raise RuntimeError("Missing DB config. Set DATABASE_URL or DB_* vars.")

    return psycopg2.connect(**params)

def init_db():
    """
    Create/upgrade the sessions table:
      - timestamp is TIMESTAMPTZ (UTC)
      - wall_time_local is IST display string
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        label TEXT,
        timestamp TIMESTAMPTZ,
        wall_time_local TEXT,

        mouse_path JSONB,
        scroll_depth INTEGER,
        click_delay DOUBLE PRECISION,
        click_positions JSONB,
        total_clicks INTEGER,
        ad_clicks INTEGER,
        hover_times JSONB,
        session_duration DOUBLE PRECISION,
        fingerprint JSONB,

        ad_hover_time DOUBLE PRECISION,
        ad_visible_time DOUBLE PRECISION,
        ad_click_coordinates JSONB,
        ad_visibility_changes JSONB,
        ad_dwell_time DOUBLE PRECISION,
        ad_click_accuracy DOUBLE PRECISION,
        repeated_ad_clicks INTEGER,
        scroll_to_ad_time DOUBLE PRECISION
    );
    """)

    # If legacy 'timestamp' was TIMESTAMP (naive), convert as IST -> UTC TIMESTAMPTZ
    cur.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='sessions'
              AND column_name='timestamp'
              AND data_type='timestamp without time zone'
        ) THEN
            ALTER TABLE sessions
            ALTER COLUMN timestamp TYPE TIMESTAMPTZ
            USING (timestamp AT TIME ZONE 'Asia/Calcutta');
        END IF;
    END$$;
    """)

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    init_db()
    conn = get_connection()
    print("DB OK:", conn.get_dsn_parameters())
    conn.close()
