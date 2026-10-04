-- SIGNAL · V2 identity & personal context. Does NOT modify V1.

-- users: add account status
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DISABLED'));

-- user_profiles: complete profile columns
ALTER TABLE user_profiles ADD COLUMN avatar_url text;
ALTER TABLE user_profiles ADD COLUMN language text NOT NULL DEFAULT 'zh-CN';
ALTER TABLE user_profiles ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Shanghai';

-- goals: description
ALTER TABLE goals ADD COLUMN description text;

-- interests: normalized name for dedupe
ALTER TABLE interests ADD COLUMN normalized_name text;
UPDATE interests SET normalized_name = lower(trim(name));
ALTER TABLE interests ALTER COLUMN normalized_name SET NOT NULL;
ALTER TABLE interests ADD CONSTRAINT uq_interest_user_normalized UNIQUE (user_id, normalized_name);

-- skills (new)
CREATE TABLE skills (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          text NOT NULL,
    normalized_name text NOT NULL,
    level         text NOT NULL DEFAULT 'BEGINNER'
                  CHECK (level IN ('BEGINNER','INTERMEDIATE','ADVANCED','EXPERT')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, normalized_name)
);
CREATE INDEX idx_skills_user ON skills(user_id);

-- refresh tokens: store ONLY the hash, rotation + revocation
CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti         text NOT NULL UNIQUE,
    token_hash  text NOT NULL,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expires ON refresh_tokens(expires_at);
