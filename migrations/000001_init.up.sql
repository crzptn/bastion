CREATE TABLE IF NOT EXISTS bastion_schema_marker (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1)
);

INSERT INTO bastion_schema_marker (id) VALUES (1) ON CONFLICT DO NOTHING;
