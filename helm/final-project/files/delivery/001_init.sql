-- Delivery providers with their pricing parameters
CREATE TABLE IF NOT EXISTS providers (
    id             BIGSERIAL PRIMARY KEY,
    name           TEXT           NOT NULL,
    base_price     NUMERIC(18, 2) NOT NULL,
    price_per_kg   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    days_estimated INT            NOT NULL DEFAULT 3,
    active         BOOLEAN        NOT NULL DEFAULT TRUE
);

INSERT INTO providers (name, base_price, price_per_kg, days_estimated)
SELECT * FROM (VALUES
    ('Pochta Rossii', 150.00, 40.00, 7),
    ('CDEK',          250.00, 60.00, 3),
    ('Boxberry',      200.00, 50.00, 4)
) AS v(name, base_price, price_per_kg, days_estimated)
WHERE NOT EXISTS (SELECT 1 FROM providers);

-- Deliveries, created from the `order` topic after the order is paid
CREATE TABLE IF NOT EXISTS deliveries (
    id           UUID PRIMARY KEY,
    order_id     UUID           NOT NULL UNIQUE,
    seller_id    BIGINT         NOT NULL,
    receiver_id  BIGINT         NOT NULL,
    provider_id  BIGINT         NOT NULL REFERENCES providers(id),
    status       VARCHAR(32)    NOT NULL DEFAULT 'AWAIT_CONFIRMATION',
    price        NUMERIC(18, 2) NOT NULL,
    items        JSONB          NOT NULL DEFAULT '[]'::jsonb,
    address_from JSONB          NOT NULL DEFAULT '{}'::jsonb,
    address_to   JSONB          NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status   ON deliveries(status);

-- Processed events, for consumer idempotency
CREATE TABLE IF NOT EXISTS processed_events (
    event_id     UUID PRIMARY KEY,
    event_type   TEXT        NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
