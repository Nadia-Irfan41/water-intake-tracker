-- Run once in PostgreSQL (skip any column you already have)
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level VARCHAR(10);
