CREATE TABLE IF NOT EXISTS validation_tasks (
    id          BIGSERIAL PRIMARY KEY,
    ad_id       TEXT        NOT NULL UNIQUE,
    status      TEXT        NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | APPROVED | REJECTED
    mode        TEXT,                                   -- NULL (не распределена) | AUTO | MANUAL
    payload     JSONB       NOT NULL,                   -- исходный advert из AdCreated
    result      JSONB,                                  -- результат валидации (text_validation, image_validation, ...)
    attempts    INT         NOT NULL DEFAULT 0,
    locked_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_tasks_status ON validation_tasks (status, created_at);
CREATE INDEX IF NOT EXISTS idx_validation_tasks_manual ON validation_tasks (status, mode) WHERE mode = 'MANUAL';

CREATE TABLE IF NOT EXISTS moderation_config (
    id         BOOL PRIMARY KEY DEFAULT TRUE CHECK (id), -- singleton row
    mode       TEXT NOT NULL DEFAULT 'AUTO',             -- AUTO | MANUAL | HYBRID
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO moderation_config (id, mode) VALUES (TRUE, 'AUTO')
ON CONFLICT (id) DO NOTHING;