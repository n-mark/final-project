-- Transactional outbox: messages persisted in the same transaction as the
-- advert and delivered to Kafka by the outbox worker.
CREATE TABLE IF NOT EXISTS outbox (
    id         UUID PRIMARY KEY,
    topic      TEXT      NOT NULL,
    key        TEXT      NOT NULL,
    payload    JSONB     NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    sent_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (created_at) WHERE sent_at IS NULL;
