CREATE TABLE profile (
    profile_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    userid bigint NOT NULL,
    name varchar(255),
    surname varchar(255),
    date_of_birth timestamp,
    gender varchar(20),
    city varchar(255),
    bio text,
    interests text,
    status varchar(255),
    CONSTRAINT uq_user
        UNIQUE (userid)
);

