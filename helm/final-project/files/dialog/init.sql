CREATE TABLE IF NOT EXISTS messages (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    conversation_id text        NOT NULL,   -- shard distribution column
    from_user_id    bigint      NOT NULL,
    to_user_id      bigint      NOT NULL,
    text            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (conversation_id, id)       -- distribution col must be in PK
);

-- Conversation index: one row per user per dialog.
-- Sharded by owner_id so "all my conversations" is a single-shard query.
-- In Citus run: create_distributed_table('conversations', 'owner_id');
CREATE TABLE IF NOT EXISTS conversations (
    owner_id          bigint      NOT NULL,   -- shard distribution column
    peer_id           bigint      NOT NULL,
    conversation_id   text        NOT NULL,
    last_message_id   uuid,
    last_message_text text,
    last_message_from bigint,
    last_message_at   timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (owner_id, peer_id)         -- distribution col must be in PK
);
