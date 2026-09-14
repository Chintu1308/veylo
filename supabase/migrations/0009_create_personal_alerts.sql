CREATE TABLE personal_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_rule TEXT NOT NULL,
    destination_ip TEXT NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by user and project
CREATE INDEX idx_personal_alerts_user_project ON personal_alerts(user_id, project_id);

-- Enforce Row-Level Security (RLS)
ALTER TABLE personal_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own personal alerts"
    ON personal_alerts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal alerts"
    ON personal_alerts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal alerts"
    ON personal_alerts FOR DELETE
    USING (auth.uid() = user_id);
