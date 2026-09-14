CREATE TABLE personal_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by user and project
CREATE INDEX idx_personal_alert_rules_user_project ON personal_alert_rules(user_id, project_id);

-- Enforce Row-Level Security (RLS)
ALTER TABLE personal_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert rules"
    ON personal_alert_rules FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert rules"
    ON personal_alert_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert rules"
    ON personal_alert_rules FOR DELETE
    USING (auth.uid() = user_id);
