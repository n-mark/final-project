CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  email         VARCHAR(255) NOT NULL DEFAULT '',
  phone         VARCHAR(50)  NOT NULL DEFAULT '',
  status        VARCHAR(50)  NOT NULL DEFAULT 'CONFIRM_PENDING',
  confirmation_token VARCHAR(255) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX idx_token ON users USING hash (confirmation_token);
