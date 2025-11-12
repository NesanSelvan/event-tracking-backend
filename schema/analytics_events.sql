-- Analytics Events table to store all tracked events
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event varchar(255) NOT NULL,
  url text,
  referrer text,
  device varchar(50),
  ip_address inet,
  timestamp timestamptz NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_application_id ON analytics_events(application_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_device ON analytics_events(device);
