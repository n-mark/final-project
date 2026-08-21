CREATE TABLE IF NOT EXISTS public.validation_failure
(
    advert_id uuid NOT NULL,
    kind TEXT NOT NULL,
	banned_value TEXT,
	explanation TEXT,
	markdown TEXT,
	picture_order SMALLINT,
	created_time timestamp(0) without time zone NOT NULL,
    CONSTRAINT check_kind CHECK (kind = ANY (ARRAY['IMAGE'::text, 'TITLE'::text, 'DESCRIPTION'::text])),
	CONSTRAINT validation_failure_advert_id_foreign FOREIGN KEY (advert_id)
        REFERENCES public.advert (id) MATCH SIMPLE
		ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;