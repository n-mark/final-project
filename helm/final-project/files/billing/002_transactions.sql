-- Payment transactions: created via HTTP, resolved by the (emulated) payment
-- gateway, result is published to the `order-payment` topic.
--
-- A single order may have multiple transaction attempts (retries), so order_id
-- is not UNIQUE. Instead we enforce at most one active (payment_required) or
-- successful (paid) transaction per order via a partial unique index.
CREATE TABLE IF NOT EXISTS transactions (
    id         UUID PRIMARY KEY,
    order_id   UUID           NOT NULL,
    user_id    BIGINT         NOT NULL,
    amount     NUMERIC(18, 2) NOT NULL,
    status     VARCHAR(32)    NOT NULL DEFAULT 'payment_required',
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status   ON transactions(status);

-- Only one active or paid transaction per order. Failed transactions can be
-- retried by inserting a new row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_active_or_paid_order
    ON transactions(order_id)
    WHERE status IN ('payment_required', 'paid');
