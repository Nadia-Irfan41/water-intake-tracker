-- Optional: the backend creates this table automatically on start; run only if you want to create it manually.
CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id          INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  interval_minutes INTEGER NOT NULL DEFAULT 60,
  start_time       TIME NOT NULL DEFAULT '08:00',
  end_time         TIME NOT NULL DEFAULT '22:00',
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
